export interface ExtensionSession { accessToken:string; refreshToken:string; expiresAt:number; userId:string; email:string|null }
type Fetch = typeof fetch;

export function trustedHandoff(senderUrl:string|undefined,webOrigin:string,pathname='/extension-auth'):boolean {
  try { const url=new URL(senderUrl??''); return url.origin===new URL(webOrigin).origin&&url.pathname===pathname&&!url.username&&!url.password; } catch { return false; }
}

/** The web app sends a one-time token hash; it carries no session itself. */
export function validateHandoff(value:unknown):string {
  const tokenHash=(value as {tokenHash?:unknown}|null)?.tokenHash;
  if(typeof tokenHash!=='string'||!/^[A-Za-z0-9_-]{20,200}$/.test(tokenHash)) throw new Error('Invalid sign-in handoff');
  return tokenHash;
}

function toSession(body:Record<string,unknown>):ExtensionSession {
  const user=body.user as {id?:unknown;email?:unknown}|undefined;
  if(typeof body.access_token!=='string'||typeof body.refresh_token!=='string'||typeof user?.id!=='string') throw new Error('Sign-in failed. Try connecting again.');
  const expiresAt=typeof body.expires_at==='number'?body.expires_at:Math.floor(Date.now()/1000)+(typeof body.expires_in==='number'?body.expires_in:3600);
  return { accessToken:body.access_token, refreshToken:body.refresh_token, expiresAt, userId:user.id, email:typeof user.email==='string'?user.email:null };
}

async function authRequest(api:string,key:string,path:string,payload:unknown,fetchFn:Fetch):Promise<ExtensionSession> {
  const response=await fetchFn(`${api}/auth/v1/${path}`,{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify(payload)});
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok) {
    const error=new Error(typeof body.msg==='string'?body.msg:typeof body.error_description==='string'?body.error_description:`Sign-in failed (${response.status})`);
    (error as Error&{status?:number}).status=response.status;
    throw error;
  }
  return toSession(body);
}

/** Exchanges the one-time token for the extension's own session, separate from the web app's. */
export function sessionFromTokenHash(api:string,key:string,tokenHash:string,fetchFn:Fetch=fetch):Promise<ExtensionSession> {
  return authRequest(api,key,'verify',{type:'magiclink',token_hash:tokenHash},fetchFn);
}

export function refreshSession(api:string,key:string,session:ExtensionSession,fetchFn:Fetch=fetch):Promise<ExtensionSession> {
  return authRequest(api,key,'token?grant_type=refresh_token',{refresh_token:session.refreshToken},fetchFn);
}

/** True when the access token has less than `minSeconds` left. */
export function needsRefresh(session:ExtensionSession,minSeconds=600,now=Date.now()):boolean {
  return session.expiresAt-now/1000<minSeconds;
}
