-- Native-voice TTS providers: ElevenLabs and Fish Audio direct (audio kind)
alter table user_api_keys drop constraint user_api_keys_provider_check;
alter table user_api_keys add constraint user_api_keys_provider_check
  check (provider in ('anthropic','openai','fal','together','higgsfield','openrouter','elevenlabs','fish'));
