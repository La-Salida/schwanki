import { describe,expect,it } from 'vitest';
import { allowedExtension,EXTENSION_IDS,handoffPayload } from './extensionAuth';
describe('extension sign-in handoff',()=>{
 it('allows only known extension IDs',()=>{
  expect(allowedExtension(EXTENSION_IDS[0]!)).toBe(true);
  expect(allowedExtension('a'.repeat(32),'a'.repeat(32))).toBe(true);
  expect(allowedExtension('b'.repeat(32),'a'.repeat(32))).toBe(false);
  expect(allowedExtension('bad-id','bad-id')).toBe(false);
 });
 it('sends only a one-time token, never the page session',()=>{
  expect(handoffPayload('f'.repeat(56))).toEqual({action:'session-handoff',tokenHash:'f'.repeat(56)});
  expect(()=>handoffPayload('')).toThrow();
 });
});
