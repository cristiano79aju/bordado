import {randomBytes, pbkdf2Sync} from 'node:crypto';
import {stdin, stdout, stderr} from 'node:process';
import {createInterface} from 'node:readline';

const rl = createInterface({input:stdin, output:stdout, terminal:true});
stdout.write('Nova senha do administrador (mínimo 12 caracteres): ');
const password = await new Promise(resolve=>{
  let value='';
  stdin.setRawMode?.(true);
  stdin.resume();
  stdin.on('data',chunk=>{
    const c=chunk.toString();
    if(c==='\r'||c==='\n'){stdout.write('\n');stdin.setRawMode?.(false);resolve(value);}
    else if(c==='\u0003'){stdout.write('\n');process.exit(130);}
    else if(c==='\u007f'){value=value.slice(0,-1);}
    else value+=c;
  });
});
rl.close();
if(password.length<12||password.length>256){stderr.write('Use uma senha forte de 12 a 256 caracteres.\n');process.exit(1);}
const salt=randomBytes(16);
const hash=pbkdf2Sync(password,salt,210000,32,'sha256');
stdout.write('\nCole apenas o valor abaixo em ADMIN_PASSWORD_HASH na Vercel:\n'+salt.toString('hex')+':'+hash.toString('hex')+'\n');
