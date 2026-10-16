-- DeepSeek direct as a bring-your-own-key sentence provider (also Schwanki AI's default)
alter table user_api_keys drop constraint user_api_keys_provider_check;
alter table user_api_keys add constraint user_api_keys_provider_check
  check (provider in ('anthropic','openai','fal','together','higgsfield','openrouter','deepseek','elevenlabs','fish'));
