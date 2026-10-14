import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Beheer — MAIN CHARACTER', robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ fout?: string }> }) {
  if (await isAdmin()) redirect('/beheer');
  const { fout } = await searchParams;
  return (
    <div className="admin-login">
      <form className="login-card enter" method="post" action="/api/admin/login">
        <p className="wordmark-dark">MAIN&nbsp;CHARACTER</p>
        <h1 className="title">Afspraken beheren</h1>
        {!env.adminPassword
          ? <p className="alert">Beheer is nog niet ingesteld: de instelling ADMIN_PASSWORD ontbreekt.</p>
          : <>
              {fout && <p className="alert">Dat wachtwoord klopt niet.</p>}
              <label className="field"><span>Wachtwoord</span><input type="password" name="password" required autoFocus autoComplete="current-password" /></label>
              <button className="btn wide">Inloggen</button>
            </>}
      </form>
    </div>
  );
}
