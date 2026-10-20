import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const required=name=>{const v=process.env[name];if(!v||!path.isAbsolute(v))throw Error(name+' must be an explicit absolute task-local directory');return path.resolve(v);};
const javaHome=required('ANDROID_LOCAL_JAVA_HOME'),sdk=required('ANDROID_LOCAL_SDK_ROOT'),work=required('ANDROID_LOCAL_WORKROOT'),out=required('ANDROID_BUILD_EVIDENCE_DIR');
if(work===os.homedir()||work===root||!path.relative(root,work).startsWith('..'))throw Error('Build cache/private state must be outside source and not the user home');
const mode=process.argv[2]??':app:assembleDebug';if(![':app:assembleDebug','--version'].includes(mode))throw Error('Only local debug compilation/version probe supported; no release signing/upload');
for(const p of [sdk,work,path.join(work,'scratch'),path.join(work,'private/android-user'),path.join(work,'private/java-home')])fs.mkdirSync(p,{recursive:true});fs.mkdirSync(out);
const env={...process.env,JAVA_HOME:javaHome,ANDROID_HOME:sdk,ANDROID_SDK_ROOT:sdk,ANDROID_USER_HOME:path.join(work,'private/android-user'),GRADLE_USER_HOME:path.join(work,'gradle-user'),GRADLE_OPTS:'',JAVA_TOOL_OPTIONS:`-Duser.home="${path.join(work,'private/java-home')}" -Djava.io.tmpdir="${path.join(work,'scratch')}"`,TMP:path.join(work,'scratch'),TEMP:path.join(work,'scratch'),TMPDIR:path.join(work,'scratch'),PATH:path.join(javaHome,'bin')+path.delimiter+process.env.PATH};
// JVM args are separate argv entries: handles Windows paths safely without a shell/password arguments.
const args=['-Duser.home='+path.join(work,'private/java-home'),'-Djava.io.tmpdir='+path.join(work,'scratch'),'-classpath',path.join(root,'android/gradle/wrapper/gradle-wrapper.jar'),'org.gradle.wrapper.GradleWrapperMain','--no-daemon','--max-workers=1','-Pandroid.builder.sdkDownload=false',mode];
const executable=path.join(javaHome,'bin',process.platform==='win32'?'java.exe':'java');
const r=cp.spawnSync(executable,args,{cwd:path.join(root,'android'),env,encoding:'utf8',timeout:600000,maxBuffer:20000000});
for(const [n,v] of Object.entries({'stdout.log':r.stdout??'','stderr.log':r.stderr??'','command.json':JSON.stringify({executable,args,cwd:path.join(root,'android'),exit:r.status,signal:r.signal,error:r.error?.message??null,javaHome,sdk,work,policy:'No SDK auto-download/licence acceptance, no global paths or release key. Private debug signing state if generated is excluded from delivery.'},null,2)}))fs.writeFileSync(path.join(out,n),v,{flag:'wx'});
console.log(r.stdout);console.error(r.stderr);console.log('GRADLE_ACTUAL_EXIT',r.status);process.exitCode=r.status??2;
