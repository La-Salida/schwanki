import { describe,expect,it } from 'vitest';
import { trustedHandoff,validateSession } from './auth';
describe('shared extension authentication boundary',()=>{
 it('accepts only the configured origin and exact handoff path',()=>{expect(trustedHandoff('https://app.example/extension-auth','https://app.example')).toBe(true);for(const url of ['https://evil.example/extension-auth','https://app.example.evil/extension-auth','https://app.example/class','https://user:password@app.example/extension-auth'])expect(trustedHandoff(url,'https://app.example')).toBe(false);});
 it('rejects expired and malformed sessions without persisting them',()=>{expect(()=>validateSession({accessToken:'a'.repeat(30),refreshToken:'refresh',userId:'owner',expiresAt:0})).toThrow('expired');expect(()=>validateSession({})).toThrow('Invalid');});
});
