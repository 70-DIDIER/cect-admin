import { Helmet } from 'react-helmet-async'
import { ArrowRight, BadgeCheck, FileKey2, Globe2, KeyRound, LockKeyhole, ShieldCheck, TriangleAlert } from 'lucide-react'

const SUPERADMIN_ENTRY = '/superadmin/connexion'

/** Public, informational PRE-ACCESS page. Never checks, bypasses or manufactures client authentication. */
export default function SuperadminAccessGuidePage() {
  return <main className="min-h-screen bg-[var(--dash-bg)] px-4 py-9 text-[var(--color-text)] sm:py-14">
    <Helmet><title>Accès sécurisé Superadmin — CECT</title></Helmet>
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white"><ShieldCheck size={24} aria-hidden /></span>
        <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[var(--color-primary)]">CECT · Direction générale</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Accès Superadmin sécurisé</h1></div>
      </header>
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--dash-card)] p-5 shadow-[var(--shadow-card)] sm:p-7">
        <p className="text-sm leading-6 text-[var(--color-text-muted)]">Vous n’êtes pas sur le formulaire de connexion des administrateurs ordinaires. Le Superadmin présente d’abord un <strong className="text-[var(--color-text)]">certificat personnel dans le navigateur</strong>, puis sa clé cryptographique et ses codes de vérification. Aucun mot de passe du personnel ne remplace ces contrôles.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            {icon:Globe2,title:'1. Navigateur',desc:'Utiliser Firefox ou un navigateur qui possède le certificat personnel CECT.'},
            {icon:FileKey2,title:'2. Certificat .p12',desc:'Installer votre certificat client dans le gestionnaire de certificats. Il ne faut pas importer la clé .cectkey ici.'},
            {icon:KeyRound,title:'3. Clé + vérification',desc:'Après la vérification mTLS, charger votre fichier .cectkey et confirmer les codes exigés.'},
          ].map(({icon:Icon,title,desc})=><div key={title} className="rounded-2xl border border-[var(--color-border)] bg-[var(--dash-bg)] p-4"><Icon className="text-[var(--color-primary)]" size={20} aria-hidden /><h2 className="mt-3 text-sm font-extrabold">{title}</h2><p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{desc}</p></div>)}
        </div>
        <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/[.06] p-4">
          <h2 className="flex items-center gap-2 text-sm font-extrabold"><TriangleAlert size={18} className="text-amber-500" aria-hidden />Si Firefox affiche « 403 Forbidden »</h2>
          <p className="mt-2 text-xs leading-6 text-[var(--color-text-muted)]">Le serveur a refusé l’accès avant même de charger le portail. Dans Firefox : <strong>Paramètres → Vie privée et sécurité → Certificats → Afficher les certificats → Vos certificats → Importer</strong>, sélectionnez votre fichier client <strong>.p12/.pfx</strong>, puis confirmez le mot de passe du certificat. Fermez et rouvrez l’onglet sécurisé. Si le certificat est absent, expiré ou révoqué, demandez son renouvellement au responsable habilité : cette page ne permet pas de contourner la protection.</p>
        </div>
        <a href={SUPERADMIN_ENTRY} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-extrabold text-white transition hover:bg-emerald-700"><LockKeyhole size={18} aria-hidden />Continuer vers le portail protégé <ArrowRight size={18} aria-hidden /></a>
        <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]"><BadgeCheck size={15} aria-hidden />L’accès reste contrôlé par le serveur Nginx mTLS. Ni cette page ni son bouton n’accordent d’autorisation.</p>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]"><a href="/connexion" className="underline underline-offset-4">Connexion de l’équipe (non Superadmin)</a><span>CECT · Coopérative CECT Togo</span></div>
    </div>
  </main>
}
