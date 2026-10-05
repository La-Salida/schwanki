import { describe,expect,it } from 'vitest';
import { allowedExtension,handoffPayload } from './extensionAuth';
describe('web session handoff',()=>{
 it('fails closed when the configured extension ID differs',()=>{expect(allowedExtension('a'.repeat(32),'a'.repeat(32))).toBe(true);expect(allowedExtension('b'.repeat(32),'a'.repeat(32))).toBe(false);expect(allowedExtension('a'.repeat(32),'')).toBe(false);expect(allowedExtension('bad-id','bad-id')).toBe(false);});
 it('returns only Schwanki session fields, never Google or provider tokens',()=>{const payload=handoffPayload({access_token:'access',refresh_token:'refresh',expires_at:Date.now()/1000+100,user:{id:'owner'}});expect(payload).toEqual({action:'session-handoff',session:{accessToken:'access',refreshToken:'refresh',expiresAt:expect.any(Number),userId:'owner'}});});
});
