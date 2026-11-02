/** Extension IDs allowed to receive a sign-in token. The unpacked development build is pinned to
 *  the first one; add the Chrome Web Store ID once the store assigns it. VITE_EXTENSION_IDS adds more. */
export const EXTENSION_IDS = ["edebmddcigmjeocbjiamldcjeikhelca"];

export function allowedExtension(id:string,extra:string=""):boolean {
 if(!/^[a-p]{32}$/.test(id))return false;
 return [...EXTENSION_IDS,...extra.split(",").map(value=>value.trim())].includes(id);
}

/** The extension exchanges this one-time token for its own session. The web app's session tokens never leave the page. */
export function handoffPayload(tokenHash:string){
 if(!/^[A-Za-z0-9_-]{20,200}$/.test(tokenHash))throw new Error("Couldn't connect the extension. Try again.");
 return {action:"session-handoff",tokenHash};
}
