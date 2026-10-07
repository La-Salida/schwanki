export function allowedExtension(id:string,allowlist:string):boolean {
 return /^[a-p]{32}$/.test(id)&&allowlist.split(',').map(value=>value.trim()).includes(id);
}
export function handoffPayload(session:{access_token:string;refresh_token:string;expires_at?:number;user:{id:string}}){
 if(!session.expires_at||session.expires_at<=Date.now()/1000)throw new Error('Sign in again before connecting the extension');
 return {action:'session-handoff',session:{accessToken:session.access_token,refreshToken:session.refresh_token,expiresAt:session.expires_at,userId:session.user.id}};
}
