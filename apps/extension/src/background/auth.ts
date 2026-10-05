export interface ExtensionSession { accessToken:string;refreshToken:string;expiresAt:number;userId:string }
export function trustedHandoff(senderUrl:string|undefined,webOrigin:string,pathname='/extension-auth'):boolean {
 try{const url=new URL(senderUrl??'');return url.origin===new URL(webOrigin).origin&&url.pathname===pathname&&!url.username&&!url.password;}catch{return false;}
}
export function validateSession(value:unknown):ExtensionSession {
 if(!value||typeof value!=='object')throw new Error('Invalid session handoff');
 const session=value as Record<string,unknown>;
 if(typeof session.accessToken!=='string'||session.accessToken.length<20||typeof session.refreshToken!=='string'||!session.refreshToken||typeof session.userId!=='string'||!session.userId||typeof session.expiresAt!=='number'||session.expiresAt<=Date.now()/1000)throw new Error('Invalid or expired session handoff');
 return {accessToken:session.accessToken,refreshToken:session.refreshToken,expiresAt:session.expiresAt,userId:session.userId};
}
