'use client';

import { FormEvent, useState } from 'react';
import { CheckCircle2, Link2, LogOut, Save, ShieldCheck } from 'lucide-react';
import type { XMonitorPaymentAdminState, XMonitorPaymentProvider } from '@/lib/x-monitor-payments';
import {
  disconnectXMonitorPaymentProviderAction,
  saveXMonitorPaymentConfigAction,
  startXMonitorKyashLoginAction,
  startXMonitorPayPayLoginAction,
  verifyXMonitorKyashLoginAction,
  verifyXMonitorPayPayLoginAction,
} from './x-payment-actions';

type Notice = { kind: 'success' | 'error'; text: string } | null;

export function XMonitorPaymentSettings({
  initialState,
  loadError,
}: {
  initialState: XMonitorPaymentAdminState | null;
  loadError: string | null;
}) {
  const [state, setState] = useState<XMonitorPaymentAdminState | null>(initialState);
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);

  const [paypayChallengeId, setPaypayChallengeId] = useState<string | null>(null);
  const [paypayPrefix, setPaypayPrefix] = useState('');
  const [paypayOtp, setPaypayOtp] = useState('');
  const [paypayBusy, setPaypayBusy] = useState(false);

  const [kyashChallengeId, setKyashChallengeId] = useState<string | null>(null);
  const [kyashOtp, setKyashOtp] = useState('');
  const [kyashBusy, setKyashBusy] = useState(false);

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const result = await saveXMonitorPaymentConfigAction({
        paypayEnabled: form.get('paypayEnabled') === 'on',
        kyashEnabled: form.get('kyashEnabled') === 'on',
        pricePayPay: Number(form.get('pricePayPay') || 0),
        priceKyash: Number(form.get('priceKyash') || 0),
      });
      if (!result.ok) {
        setNotice({ kind: 'error', text: result.error });
        return;
      }
      if (result.state) setState(result.state);
      setNotice({ kind: 'success', text: '決済設定を保存しました。' });
    } finally {
      setSaving(false);
    }
  }

  async function startPayPay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setPaypayBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const result = await startXMonitorPayPayLoginAction(
        String(form.get('phone') || ''),
        String(form.get('password') || ''),
      );
      if (!result.ok) {
        setNotice({ kind: 'error', text: result.error });
        return;
      }
      setPaypayChallengeId(result.challengeId || null);
      setPaypayPrefix(result.otpPrefix || '');
      setNotice({
        kind: 'success',
        text: 'PayPayから届いたOTPコードを入力してください。',
      });
    } finally {
      setPaypayBusy(false);
    }
  }

  async function verifyPayPay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paypayChallengeId) return;
    setNotice(null);
    setPaypayBusy(true);
    try {
      const result = await verifyXMonitorPayPayLoginAction(
        paypayChallengeId,
        paypayOtp,
      );
      if (!result.ok) {
        setNotice({ kind: 'error', text: result.error });
        return;
      }
      if (result.state) setState(result.state);
      setPaypayChallengeId(null);
      setPaypayOtp('');
      setNotice({ kind: 'success', text: 'PayPayを接続しました。' });
    } finally {
      setPaypayBusy(false);
    }
  }

  async function startKyash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setKyashBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const result = await startXMonitorKyashLoginAction(
        String(form.get('email') || ''),
        String(form.get('password') || ''),
      );
      if (!result.ok) {
        setNotice({ kind: 'error', text: result.error });
        return;
      }
      setKyashChallengeId(result.challengeId || null);
      setNotice({
        kind: 'success',
        text: 'Kyashから届いたOTPコードを入力してください。',
      });
    } finally {
      setKyashBusy(false);
    }
  }

  async function verifyKyash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!kyashChallengeId) return;
    setNotice(null);
    setKyashBusy(true);
    try {
      const result = await verifyXMonitorKyashLoginAction(
        kyashChallengeId,
        kyashOtp,
      );
      if (!result.ok) {
        setNotice({ kind: 'error', text: result.error });
        return;
      }
      if (result.state) setState(result.state);
      setKyashChallengeId(null);
      setKyashOtp('');
      setNotice({ kind: 'success', text: 'Kyashを接続しました。' });
    } finally {
      setKyashBusy(false);
    }
  }

  async function disconnect(provider: XMonitorPaymentProvider) {
    setNotice(null);
    const result = await disconnectXMonitorPaymentProviderAction(provider);
    if (!result.ok) {
      setNotice({ kind: 'error', text: result.error });
      return;
    }
    if (result.state) setState(result.state);
    setNotice({
      kind: 'success',
      text: provider === 'paypay' ? 'PayPayの接続を解除しました。' : 'Kyashの接続を解除しました。',
    });
  }

  return (
    <section id="x-monitor-payment" className="mt-8 scroll-mt-8">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900">X監視 決済設定</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Discord-Botの自販機と同じ送金リンク方式です。購入者のPayPay / Kyash送金リンクを
          サーバー側で金額確認して受け取り、成功したアカウントのX監視利用期限を30日延長します。
        </p>
      </div>

      {loadError && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          決済設定を読み込めませんでした。
          <span className="mt-1 block break-words text-xs text-red-500">{loadError}</span>
        </div>
      )}
      {notice && (
        <div
          className={`mb-5 rounded-xl border p-4 text-sm ${
            notice.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      <form
        onSubmit={saveConfig}
        className="mb-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2"
      >
        <PaymentConfigCard
          provider="PayPay"
          enabledName="paypayEnabled"
          priceName="pricePayPay"
          defaultEnabled={state?.paypayEnabled ?? false}
          defaultPrice={state?.pricePayPay ?? 0}
          connected={state?.paypayConnected ?? false}
        />
        <PaymentConfigCard
          provider="Kyash"
          enabledName="kyashEnabled"
          priceName="priceKyash"
          defaultEnabled={state?.kyashEnabled ?? false}
          defaultPrice={state?.priceKyash ?? 0}
          connected={state?.kyashConnected ?? false}
        />
        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            <Save size={14} /> {saving ? '保存中...' : '料金・公開設定を保存'}
          </button>
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link2 size={17} className="text-cyan-700" />
              <h4 className="font-semibold text-slate-900">PayPay受取アカウント</h4>
            </div>
            <ConnectionBadge connected={state?.paypayConnected ?? false} />
          </div>
          {state?.paypayConnected ? (
            <button
              type="button"
              onClick={() => disconnect('paypay')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
            >
              <LogOut size={13} /> 接続を解除
            </button>
          ) : paypayChallengeId ? (
            <form onSubmit={verifyPayPay} className="space-y-3">
              {paypayPrefix && (
                <p className="text-xs text-slate-500">OTPプレフィックス: {paypayPrefix}</p>
              )}
              <input
                value={paypayOtp}
                onChange={(event) => setPaypayOtp(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="OTPコード"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={paypayBusy}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {paypayBusy ? '確認中...' : 'OTPを確認して接続'}
              </button>
            </form>
          ) : (
            <form onSubmit={startPayPay} className="space-y-3">
              <input
                name="phone"
                autoComplete="username"
                placeholder="PayPayの電話番号"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              />
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="PayPayのパスワード"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={paypayBusy}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {paypayBusy ? '接続中...' : 'PayPayに接続'}
              </button>
            </form>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link2 size={17} className="text-cyan-700" />
              <h4 className="font-semibold text-slate-900">Kyash受取アカウント</h4>
            </div>
            <ConnectionBadge connected={state?.kyashConnected ?? false} />
          </div>
          {state?.kyashConnected ? (
            <button
              type="button"
              onClick={() => disconnect('kyash')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
            >
              <LogOut size={13} /> 接続を解除
            </button>
          ) : kyashChallengeId ? (
            <form onSubmit={verifyKyash} className="space-y-3">
              <input
                value={kyashOtp}
                onChange={(event) => setKyashOtp(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="OTPコード"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={kyashBusy}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {kyashBusy ? '確認中...' : 'OTPを確認して接続'}
              </button>
            </form>
          ) : (
            <form onSubmit={startKyash} className="space-y-3">
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="Kyashのメールアドレス"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              />
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Kyashのパスワード"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={kyashBusy}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {kyashBusy ? '接続中...' : 'Kyashに接続'}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-cyan-700" />
        ログイン情報・アクセストークン・送金リンクはブラウザへ返さずサーバー側で暗号化保存します。
        PayPayはパスコード付き送金リンクには対応しません。
      </div>
    </section>
  );
}

function PaymentConfigCard({
  provider,
  enabledName,
  priceName,
  defaultEnabled,
  defaultPrice,
  connected,
}: {
  provider: string;
  enabledName: string;
  priceName: string;
  defaultEnabled: boolean;
  defaultPrice: number;
  connected: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <strong className="text-sm text-slate-900">{provider}</strong>
        <ConnectionBadge connected={connected} />
      </div>
      <label className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-700">
        <input type="checkbox" name={enabledName} defaultChecked={defaultEnabled} />
        購入者に表示する
      </label>
      <label className="mt-3 block text-xs text-slate-600">
        30日分の料金
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            name={priceName}
            min={0}
            max={1000000}
            step={1}
            defaultValue={defaultPrice}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <span>円</span>
        </div>
      </label>
    </div>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        connected
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-amber-100 text-amber-800'
      }`}
    >
      {connected && <CheckCircle2 size={12} />}
      {connected ? '接続済み' : '未接続'}
    </span>
  );
}
