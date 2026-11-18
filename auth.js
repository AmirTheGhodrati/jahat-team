// Migrate the previous tab-scoped session without asking the user to sign in again.
const authStorageKey = `sb-${new URL(window.JAHAT_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
try {
  const previousSession = sessionStorage.getItem(authStorageKey);
  if (previousSession && !localStorage.getItem(authStorageKey)) localStorage.setItem(authStorageKey, previousSession);
  if (previousSession) sessionStorage.removeItem(authStorageKey);
} catch (_) { /* Browser storage may be unavailable. */ }
const client = window.supabase.createClient(
  window.JAHAT_SUPABASE_URL,
  window.JAHAT_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: window.localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  }
);

const $auth = document.querySelector('#auth');
const $app = document.querySelector('#app');
const $message = document.querySelector('#auth-message');
const $loginForm = document.querySelector('#login-form');
const $retry = document.querySelector('#retry-access');
let currentUser = null;
let isAdmin = false;
let authCheckError = '';

async function activate() {
  const { data: { session }, error } = await client.auth.getSession();

  if (error) {
    $auth.hidden = false;
    $app.hidden = true;
    $loginForm?.classList.add('hidden');
    $retry?.classList.remove('hidden');
    if ($message) $message.textContent = 'وضعیت ورود بررسی نشد. اتصال را بررسی کنید و دوباره تلاش کنید.';
    return false;
  }

  if (!session) {
    currentUser = null;
    isAdmin = false;
    $auth.hidden = false;
    $app.hidden = true;
    $loginForm?.classList.remove('hidden');
    $retry?.classList.add('hidden');
    return false;
  }

  const member = await client.rpc('is_team_member');
  if (member.error) {
    $auth.hidden = false;
    $app.hidden = true;
    $loginForm?.classList.add('hidden');
    $retry?.classList.remove('hidden');
    authCheckError = 'بررسی دسترسی موقتاً انجام نشد. نشست شما حفظ شده است؛ اتصال را بررسی کنید و دوباره تلاش کنید.';
    if ($message) $message.textContent = authCheckError;
    return false;
  }

  if (member.data !== true) {
    await client.auth.signOut();
    currentUser = null;
    isAdmin = false;
    $auth.hidden = false;
    $app.hidden = true;
    $loginForm?.classList.remove('hidden');
    $retry?.classList.add('hidden');
    if ($message) $message.textContent = 'این حساب به فضای تیم دسترسی ندارد.';
    return false;
  }

  const admin = await client.rpc('is_team_admin');
  currentUser = session.user;
  isAdmin = !admin.error && admin.data === true;
  authCheckError = admin.error ? 'سطح دسترسی مدیر در حال حاضر بررسی نشد؛ امکانات ویرایش تا اتصال دوباره در دسترس نیست.' : '';

  const email = document.querySelector('#user-email');
  if (email) email.textContent = currentUser.email || '';

  const notice = document.querySelector('#notice');
  if (notice && authCheckError) notice.textContent = authCheckError;

  $auth.hidden = true;
  $app.hidden = false;
  return true;
}

$loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formElement = event.currentTarget;
  if ($message) $message.textContent = 'در حال ورود…';

  const form = new FormData(formElement);
  const { error } = await client.auth.signInWithPassword({
    email: String(form.get('email')).trim(),
    password: String(form.get('password'))
  });

  if (error) {
    if ($message) {
      $message.textContent = error.name === 'AuthRetryableFetchError' || error.status === 0
        ? 'اتصال به سرور برقرار نشد. اینترنت یا اتصال امن شبکه را بررسی کنید.'
        : 'ورود ناموفق بود. ایمیل و رمز را بررسی کنید.';
    }
    return;
  }

  formElement.reset();
  if (await activate()) location.reload();
});

document.querySelector('#retry-access')?.addEventListener('click', async () => {
  if ($message) $message.textContent = 'در حال بررسی دسترسی…';
  if (await activate()) location.reload();
});

document.querySelector('#logout')?.addEventListener('click', async () => {
  await client.auth.signOut();
  location.reload();
});

document.querySelector('#change-password')?.addEventListener('click', () => {
  document.querySelector('#password-dialog')?.showModal();
});

document.querySelector('#password-cancel')?.addEventListener('click', () => {
  document.querySelector('#password-dialog')?.close();
});

document.querySelector('#password-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formElement = event.currentTarget;
  const message = document.querySelector('#password-message');
  if (message) message.textContent = 'در حال ثبت…';

  const { error } = await client.auth.updateUser({
    password: new FormData(formElement).get('new_password')
  });

  if (error) {
    if (message) message.textContent = 'تغییر رمز انجام نشد؛ لطفاً دوباره تلاش کنید.';
    return;
  }

  formElement.reset();
  if (message) message.textContent = 'رمز تغییر کرد.';
});
