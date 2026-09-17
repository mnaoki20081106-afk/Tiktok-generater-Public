import Link from 'next/link';
import { ArrowRight, LayoutTemplate, MousePointer2, ChartNoAxesCombined, Link2 } from 'lucide-react';
import { StudioHeader } from '@/components/StudioHeader';

export default function HomePage() {
  return (
    <div className="studio-shell marketing-shell">
      <StudioHeader publicView />
      <main>
        <section className="studio-hero">
          <p className="studio-eyebrow">YOUR LINK. YOUR EXPRESSION.</p>
          <h1>ひとつのリンクに、<br /><span>あなたらしさを。</span></h1>
          <p className="studio-lead">選んで、触れて、公開する。<br />思い描いたページを、そのまま指先から。</p>
          <Link className="studio-primary" href="/login">ページをつくる <ArrowRight size={17} /></Link>
          <p className="studio-caption">Googleアカウントで、すぐにはじめられます。</p>
          <div className="hero-object" aria-hidden="true">
            <div className="hero-orbit" />
            <div className="hero-glass"><Link2 size={46} strokeWidth={1} /><span>Made for your next idea.</span><div className="hero-glass-line" /><div className="hero-glass-line short" /></div>
            <span className="hero-tag">DESIGN. EDIT. SHARE.</span>
          </div>
        </section>
        <section className="studio-features" aria-label="できること">
          <article><LayoutTemplate size={25} /><p className="studio-eyebrow">01 / CREATE</p><h2>伝え方は、自由。</h2><p>ニュース、SNS、ライブ配信。8つのモードから、あなたに合った見せ方を。</p></article>
          <article><MousePointer2 size={25} /><p className="studio-eyebrow">02 / EDIT</p><h2>見たまま、つくる。</h2><p>プレビューの文字や画像をタップ。仕上がりを確かめながら、直感的に編集。</p></article>
          <article><ChartNoAxesCombined size={25} /><p className="studio-eyebrow">03 / INSIGHT</p><h2>届けた、その先へ。</h2><p>公開したページのアクセスをグラフで確認。リンクの反応を、ひと目で。</p></article>
        </section>
      </main>
      <footer className="studio-footer"><span>ProfileHub Studio</span><Link href="/login">あなたのページをつくる <ArrowRight size={14} /></Link></footer>
    </div>
  );
}
