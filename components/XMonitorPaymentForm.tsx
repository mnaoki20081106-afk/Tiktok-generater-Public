'use client';

import { FormEvent, useMemo, useState } from 'react';
import { CircleCheck, RefreshCw, WalletCards } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type {
  XMonitorPaymentProvider,
  XMonitorPaymentPublicConfig,
  XMonitorPaymentResult,
} from '@/lib/x-monitor-payments';
import {
  retryXMonitorPaymentAction,
  submitXMonitorPaymentAction,
} from '@/app/x-monitor/upgrade/payment-actions';

export function XMonitorPaymentForm({
  config,
  pendingPayment,
}: {
  config: XMonitorPaymentPublicConfig;
  pendingPayment: { id: string; provider: XMonitorPaymentProvider } | null;
}) {
  const router = useRouter();
  const firstAvailable = config.paypay.available
    ? 'paypay'
    : config.kyash.available
      ? 'kyash'
      : 'paypay';
  const [provider, setProvider] = useState<XMonitorPaymentProvider>(firstAvailable);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [result, setResult] = useState<XMonitorPaymentResult | null>(null);
  const selected = config[provider];
  const anyAvailable = config.paypay.available || config.kyash.available;

  const placeholder = useMemo(
    () =>
      provider === 'paypay'
        ? 'https://pay.paypay.ne.jp/...'
        : 'https://kyash.me/payments/...',
    [provider],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setBusy(true);
    try {
      const next = await submitXMonitorPaymentAction({ provider, link });
      setResult(next);
      if (next.ok) {
        setLink('');
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (!pendingPayment) return;
    setResult(null);
    setRetrying(true);
    try {
      const next = await retryXMonitorPaymentAction(pendingPayment.id);
      setResult(next);
      if (next.ok) router.refresh();
    } finally {
      setRetrying(false);
    }
  }

  if (!anyAvailable) {
    return (
      <div className="xmon-billing-pending" role="status">
        現在はPayPay / Kyashの受取設定が完了していないため、新しい決済を開始できません。
        既に購入済みの利用期限には影響しません。
      </div>
    );
  }

  return (
    <div className="xmon-payment-box">
      <div className="xmon-payment-methods" role="radiogroup" aria-label="決済方法">
        {config.paypay.available && (
          <button
            type="button"
            className={provider === 'paypay' ? 'active' : ''}
            onClick={() => setProvider('paypay')}
          >
            PayPay
            <strong>{config.paypay.price.toLocaleString('ja-JP')}円</strong>
          </button>
        )}
        {config.kyash.available && (
          <button
            type="button"
            className={provider === 'kyash' ? 'active' : ''}
            onClick={() => setProvider('kyash')}
          >
            Kyash
            <strong>{config.kyash.price.toLocaleString('ja-JP')}円</strong>
          </button>
        )}
      </div>

      <div className="xmon-payment-steps">
        <p><b>1.</b> {provider === 'paypay' ? 'PayPay' : 'Kyash'}で <strong>{selected.price.toLocaleString('ja-JP')}円</strong> の送金リンクを作成</p>
        <p><b>2.</b> 作成した送金リンクを下に貼り付け</p>
        <p><b>3.</b> 金額と未使用状態を確認後、受け取り成功で30日分を自動反映</p>
      </div>

      {provider === 'paypay' && (
        <p className="xmon-payment-warning">
          PayPayはパスコードを設定せずに送金リンクを作成してください。
        </p>
      )}

      <form onSubmit={submit} className="xmon-payment-form">
        <label htmlFor="xmon-payment-link">送金リンク</label>
        <input
          id="xmon-payment-link"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder={placeholder}
          required
        />
        <button
          type="submit"
          className="xmon-upgrade-button"
          disabled={busy || !selected.available}
        >
          <WalletCards size={16} />
          {busy ? '決済を確認中...' : `${selected.price.toLocaleString('ja-JP')}円を支払って30日延長`}
        </button>
      </form>

      {pendingPayment && (
        <div className="xmon-payment-retry">
          <p>
            前回の{pendingPayment.provider === 'paypay' ? 'PayPay' : 'Kyash'}決済が確認待ちです。
          </p>
          <button type="button" onClick={retry} disabled={retrying}>
            <RefreshCw size={14} />
            {retrying ? '再確認中...' : '前回の決済を再確認'}
          </button>
        </div>
      )}

      {result && (
        <div
          className={`xmon-payment-result ${result.ok ? 'is-success' : result.status === 'pending' ? 'is-pending' : 'is-error'}`}
          role={result.ok ? 'status' : 'alert'}
        >
          {result.ok && <CircleCheck size={17} />}
          <div>
            <strong>
              {result.ok ? '支払いを反映しました' : result.status === 'pending' ? '確認待ちです' : '決済できませんでした'}
            </strong>
            <p>{result.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
