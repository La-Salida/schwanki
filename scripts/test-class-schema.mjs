import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { nativeClassTestDb } from './native-class-test-db.mjs';

test(`recorded class migration against PostgreSQL (${process.env.SCHWANKI_CLASS_NATIVE ? 'native, isolated Docker' : 'PGlite'}; no production connection)`, async t => {
  const pg = process.env.SCHWANKI_CLASS_NATIVE ? await nativeClassTestDb() : await PGlite.create();
  try {
    await pg.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to authenticated, anon, service_role;
    `);
    // gen_random_uuid is built in; this runtime does not need pgcrypto.
    const baseline = await readFile(new URL('../supabase/migrations/0001_initial.sql', import.meta.url), 'utf8');
    await pg.exec(baseline.replace('create extension if not exists pgcrypto;', ''));
    const sourceFiles = await readFile(new URL('../supabase/migrations/0009_source_files.sql', import.meta.url), 'utf8');
    // Apply the actual candidate FK changes. This focused test does not certify
    // Supabase Storage, pg_cron or the complete deployment environment.
    await pg.exec(sourceFiles.slice(sourceFiles.indexOf('alter table candidate_cards'), sourceFiles.indexOf('-- PDF re-sync')));
    await pg.exec('grant all on all tables in schema public to authenticated, service_role;');
    const legacyOwner = randomUUID(), legacyCard = randomUUID();
    await pg.query('insert into auth.users(id) values($1)', [legacyOwner]);
    await pg.query("insert into cards(id,user_id,language,front,back) values($1,$2,'zh','legacy','unchanged')", [legacyCard, legacyOwner]);
    await pg.exec(await readFile(new URL('../supabase/migrations/0010_recorded_classes.sql', import.meta.url), 'utf8'));
    assert.equal((await pg.query('select kind,back from cards where id=$1', [legacyCard])).rows[0].kind, 'vocabulary');
    assert.equal((await pg.query('select kind,back from cards where id=$1', [legacyCard])).rows[0].back, 'unchanged');
    const actor = randomUUID(), stranger = randomUUID();
    await pg.query('insert into auth.users(id) values ($1),($2)', [actor, stranger]);
    async function asUser(user, fn) {
      await pg.exec('set role authenticated;');
      await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
      try { return await fn(); } finally { await pg.exec('reset role;'); }
    }
    async function seed({ user = actor, front = '你好', kind = 'vocabulary' } = {}) {
      const source = randomUUID(), recording = randomUUID(), transcript = randomUUID(), note = randomUUID(), segment = randomUUID(), item = randomUUID(), candidate = randomUUID();
      await pg.query("insert into sources(id,user_id,type,external_ref,label,language) values($1,$2,'class_recording',$3,'Tutor','zh')", [source, user, source]);
      await pg.query("insert into class_recordings(id,user_id,source_id,label,target_language,explanation_language,state,quote,max_duration_ms,max_bytes,max_authorized_credits,prepared_until) values($1,$2,$3,'Class','zh','en','ready','{}',3600000,67108864,0,now()+interval '10 minutes')", [recording, user, source]);
      await pg.query("insert into class_transcripts(id,recording_id,user_id,revision,provider,model) values($1,$2,$3,1,'test','test')", [transcript, recording, user]);
      await pg.query("insert into class_note_revisions(id,recording_id,transcript_id,user_id,revision,prompt_version,model,notes) values($1,$2,$3,$4,1,'test','test','{}')", [note, recording, transcript, user]);
      await pg.query('update class_recordings set current_transcript_id=$1,current_note_revision_id=$2 where id=$3', [transcript, note, recording]);
      await pg.query("insert into class_transcript_segments(id,transcript_id,recording_id,user_id,sequence,channel,start_ms,end_ms,text) values($1,$2,$3,$4,0,'tab',0,1000,$5)", [segment, transcript, recording, user, front]);
      await pg.query("insert into class_learning_items(id,recording_id,user_id,note_revision_id,kind,target_text,evidence_content,generated_content) values($1,$2,$3,$4,$5,$6,'{}','{}')", [item, recording, user, note, kind, front]);
      await pg.query('insert into class_learning_item_evidence(learning_item_id,segment_id,transcript_id,recording_id,user_id,quote) values($1,$2,$3,$4,$5,$6)', [item, segment, transcript, recording, user, front]);
      await pg.query("insert into candidate_cards(id,source_id,user_id,recording_id,learning_item_id,kind,front,back,raw_context) values($1,$2,$3,$4,$5,$6,$7,'hello',$7)", [candidate, source, user, recording, item, kind, front]);
      return { source, recording, transcript, note, segment, item, candidate, user };
    }
    const approve = (id, patch = {}) => pg.query('select approve_class_candidate($1,$2) as result', [id, JSON.stringify(patch)]).then(r => r.rows[0].result);
    await t.test('atomic approval, edits and idempotent retries', async () => {
      const rec = await seed();
      const first = await asUser(actor, () => approve(rec.candidate, { back: 'edited greeting' }));
      const repeat = await asUser(actor, () => approve(rec.candidate));
      assert.equal(first.created, true); assert.equal(repeat.created, false); assert.equal(repeat.cardId, first.cardId);
      assert.equal((await pg.query('select count(*)::int n from batch_cards where batch_id=$1', [first.batchId])).rows[0].n, 1);
      assert.equal((await pg.query('select status from candidate_cards where id=$1', [rec.candidate])).rows[0].status, 'approved');
      assert.equal((await pg.query('select back from cards where id=$1', [first.cardId])).rows[0].back, 'edited greeting');
      assert.equal((await pg.query('select fsrs from card_state where card_id=$1', [first.cardId])).rows[0].fsrs.state, 0);
    });
    await t.test('two same-day classes reuse vocabulary without resetting FSRS history', async () => {
      const one = await seed({ front: '重复' }), two = await seed({ front: ' 重复 ' });
      const first = await asUser(actor, () => approve(one.candidate));
      await pg.query('update card_state set reps=12,stability=42,fsrs=$1 where card_id=$2', [JSON.stringify({ reps: 12, stability: 42 }), first.cardId]);
      const before = (await pg.query('select * from card_state where card_id=$1', [first.cardId])).rows[0];
      const second = await asUser(actor, () => approve(two.candidate));
      assert.equal(second.cardId, first.cardId); assert.equal(second.created, false); assert.notEqual(second.batchId, first.batchId);
      assert.deepEqual((await pg.query('select * from card_state where card_id=$1', [first.cardId])).rows[0], before);
      assert.equal((await pg.query('select count(*)::int n from batch_cards where card_id=$1', [first.cardId])).rows[0].n, 2);
      assert.equal((await pg.query('select status from candidate_cards where id=$1', [two.candidate])).rows[0].status, 'approved');
    });
    if (pg.queryAsUser) await t.test('independent PostgreSQL sessions concurrently approve one normalized word', async () => {
      const one = await seed({ front: '并发' }), two = await seed({ front: ' 并发 ' });
      const results = await Promise.all(Array.from({ length: 8 }, (_, i) => pg.queryAsUser(actor,
        'select approve_class_candidate($1,$2) as result', [i % 2 ? one.candidate : two.candidate, '{}']).then(r => r.rows[0].result)));
      assert.equal(new Set(results.map(r => r.cardId)).size, 1);
      assert.equal(results.filter(r => r.created).length, 1);
      const card = results[0].cardId;
      assert.equal((await pg.query('select count(*)::int n from batch_cards where card_id=$1', [card])).rows[0].n, 2);
      assert.equal((await pg.query('select count(*)::int n from card_state where card_id=$1', [card])).rows[0].n, 1);
    });
    await t.test('grammar and vocabulary have distinct dedup keys', async () => {
      const word = await seed({ front: '虽然' }), grammar = await seed({ front: '虽然', kind: 'grammar' });
      const first = await asUser(actor, () => approve(word.candidate)), second = await asUser(actor, () => approve(grammar.candidate));
      assert.notEqual(first.cardId, second.cardId);
    });
    await t.test('owner RLS and parent FKs reject cross-user IDs and direct approval', async () => {
      const one = await seed({ front: '安全' }), other = await seed({ user: stranger, front: '秘密' });
      const owned = await asUser(actor, () => approve(one.candidate));
      const foreign = await asUser(stranger, () => approve(other.candidate));
      await asUser(stranger, async () => {
        assert.equal((await pg.query('select id from class_recordings where id=$1', [one.recording])).rows.length, 0);
        await assert.rejects(() => approve(one.candidate), /not found/);
        await assert.rejects(() => pg.query("update class_recordings set state='ready' where id=$1", [other.recording]), /permission denied/);
      });
      await assert.rejects(() => pg.query('insert into batch_cards(batch_id,card_id,user_id) values($1,$2,$3)', [owned.batchId, foreign.cardId, actor]), /foreign key/);
      await assert.rejects(() => pg.query("insert into class_recordings(id,user_id,source_id,label,target_language,explanation_language,quote,max_duration_ms,max_bytes,max_authorized_credits,prepared_until) values($1,$2,$3,'Class','zh','en','{}',1,1,0,now())", [randomUUID(), actor, other.source]), /foreign key/);
      await asUser(actor, () => assert.rejects(() => pg.query("update candidate_cards set status='approved' where id=$1", [one.candidate]), /atomic approval/));
    });
    await t.test('evidence checks and invalid edits roll back deck mutations', async () => {
      const rec = await seed({ front: '证据' });
      await assert.rejects(() => pg.query('update class_learning_item_evidence set quote=$1 where learning_item_id=$2', ['invented', rec.item]), /must quote/);
      await assert.rejects(() => pg.query('update class_transcript_segments set text=$1 where id=$2', ['silently rewritten', rec.segment]), /new revision/);
      const before = (await pg.query('select count(*)::int n from cards')).rows[0].n;
      await asUser(actor, () => assert.rejects(() => approve(rec.candidate, { front: '' }), /required/));
      assert.equal((await pg.query('select count(*)::int n from cards')).rows[0].n, before);
      assert.equal((await pg.query('select status from candidate_cards where id=$1', [rec.candidate])).rows[0].status, 'pending');
      await pg.query('delete from class_learning_item_evidence where learning_item_id=$1', [rec.item]);
      await asUser(actor, () => assert.rejects(() => approve(rec.candidate), /validated transcript evidence/));
    });
    await t.test('a membership failure rolls back card, state, batch and candidate approval together', async () => {
      const rec = await seed({ front: '回滚' });
      await pg.exec(`create function fail_test_membership() returns trigger language plpgsql as $$ begin
        if exists (select 1 from cards where id=new.card_id and front='回滚') then raise exception 'forced membership failure'; end if;
        return new; end $$;
        create trigger fail_test_membership before insert on batch_cards for each row execute function fail_test_membership();`);
      try {
        await asUser(actor, () => assert.rejects(() => approve(rec.candidate), /forced membership failure/));
        assert.equal((await pg.query("select count(*)::int n from cards where front='回滚'")).rows[0].n, 0);
        assert.equal((await pg.query('select count(*)::int n from batches where recording_id=$1', [rec.recording])).rows[0].n, 0);
        assert.equal((await pg.query('select status from candidate_cards where id=$1', [rec.candidate])).rows[0].status, 'pending');
      } finally { await pg.exec('drop trigger fail_test_membership on batch_cards; drop function fail_test_membership();'); }
    });
    await t.test('tombstones reject late worker output, approvals and resurrection', async () => {
      const rec = await seed({ front: '删除' });
      await pg.query("update class_recordings set state='deleting',deleted_at=now(),processing_generation=processing_generation+1 where id=$1", [rec.recording]);
      await assert.rejects(() => pg.query("update class_recordings set state='ready',deleted_at=null where id=$1", [rec.recording]), /cannot be resurrected/);
      await assert.rejects(() => pg.query("insert into class_transcripts(recording_id,user_id,revision,provider,model,processing_generation) values($1,$2,2,'test','test',1)", [rec.recording, actor]), /no longer accepts/);
      await asUser(actor, () => assert.rejects(() => approve(rec.candidate), /not available/));
    });
    await t.test('superseded jobs are rejected and source removal preserves owned suggestions', async () => {
      const rec = await seed({ front: '版本' });
      await pg.query('update class_recordings set processing_generation=1 where id=$1', [rec.recording]);
      await assert.rejects(() => pg.query("insert into class_transcripts(recording_id,user_id,revision,provider,model) values($1,$2,2,'test','test')", [rec.recording, actor]), /Superseded/);
      await asUser(actor, () => assert.rejects(() => approve(rec.candidate), /not available/));
      await pg.query('delete from sources where id=$1', [rec.source]);
      assert.equal((await asUser(actor, () => pg.query('select id from candidate_cards where id=$1', [rec.candidate]))).rows.length, 1);
    });
  } finally { await pg.close(); }
});
