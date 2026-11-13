const client = window.supabase.createClient(window.JAHAT_SUPABASE_URL, window.JAHAT_SUPABASE_PUBLISHABLE_KEY, {auth:{storage:sessionStorage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
const $auth = document.querySelector('#auth');
const $app = document.querySelector('#app');
const $message = document.querySelector('#auth-message');
let currentUser = null, isAdmin = false;
async function activate() {
  const {data:{session},error} = await client.auth.getSession();
  if (error || !session) { $auth.hidden=false; $app.hidden=true; return false; }
  const [member,admin] = await Promise.all([client.rpc('is_team_member'),client.rpc('is_team_admin')]);
  if(member.error || member.data !== true) { await client.auth.signOut(); $auth.hidden=false; $app.hidden=true; $message.textContent='این حساب به فضای تیم دسترسی ندارد.'; return false; }
  currentUser=session.user; isAdmin=admin.data===true;
  document.querySelector('#user-email').textContent=currentUser.email;
  $auth.hidden=true; $app.hidden=false;
  return true;
}
document.querySelector('#login-form').addEventListener('submit',async e=>{
 e.preventDefault(); $message.textContent='در حال ورود…';
 const form=new FormData(e.currentTarget);
 const {error}=await client.auth.signInWithPassword({email:String(form.get('email')).trim(),password:String(form.get('password'))});
 if(error){$message.textContent=error.name==='AuthRetryableFetchError'||error.status===0?'اتصال به سرور برقرار نشد. اینترنت یا اتصال امن شبکه را بررسی کنید.':'ورود ناموفق بود. ایمیل و رمز را بررسی کنید.';return}
 e.currentTarget.reset(); if(await activate()) location.reload();
});
document.querySelector('#logout').addEventListener('click',async()=>{await client.auth.signOut();location.reload()});
document.querySelector('#change-password').addEventListener('click',()=>document.querySelector('#password-dialog').showModal());
document.querySelector('#password-cancel').addEventListener('click',()=>document.querySelector('#password-dialog').close());
document.querySelector('#password-form').addEventListener('submit',async e=>{e.preventDefault();const message=document.querySelector('#password-message');message.textContent='در حال ثبت…';const {error}=await client.auth.updateUser({password:new FormData(e.currentTarget).get('new_password')});if(error){message.textContent='تغییر رمز انجام نشد؛ لطفاً دوباره تلاش کنید.';return}e.currentTarget.reset();message.textContent='رمز تغییر کرد.';});
