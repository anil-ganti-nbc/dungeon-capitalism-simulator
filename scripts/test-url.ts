/** Loopback-only test target. Never open a public endpoint or the unrelated operator port. */
export function localhostTestURL(value=process.env.TEST_URL??'http://127.0.0.1:4178'):string {
 const u=new URL(value);
 if(!['http:','https:'].includes(u.protocol)||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.username||u.password||u.port==='8765')throw Error('TEST_URL must be a loopback HTTP(S) URL, excluding the reserved operator port');
 return u.href;
}
