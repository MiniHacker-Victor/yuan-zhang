import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BarChart3,
  CircleDollarSign,
  Plus,
  ReceiptText,
  Settings as SettingsIcon,
  Target
} from 'lucide-react';
import { db, ensureDefaults } from './data/db';
import { syncRates } from './services/fx';
import type { Expense } from './types';
import Dashboard from './components/Dashboard';
import ExpenseForm from './components/ExpenseForm';
import Transactions from './components/Transactions';
import Budgets from './components/Budgets';
import SettingsPage from './components/SettingsPage';

type View = 'dashboard' | 'transactions' | 'budgets' | 'settings';

interface ToastState {
  message: string;
  tone: 'default' | 'success' | 'danger';
}

let bootstrapPromise: Promise<void> | null = null;

function bootstrap(): Promise<void> {
  bootstrapPromise ??= ensureDefaults().then(() => syncRates()).then(() => undefined);
  return bootstrapPromise;
}

const navItems: Array<{ id: View; label: string; icon: typeof BarChart3 }> = [
  { id: 'dashboard', label: '总览', icon: BarChart3 },
  { id: 'transactions', label: '账单', icon: ReceiptText },
  { id: 'budgets', label: '预算', icon: Target },
  { id: 'settings', label: '设置', icon: SettingsIcon }
];

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const expenses = useLiveQuery(() => db.expenses.toArray(), [], []);
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), [], []);
  const budgets = useLiveQuery(() => db.budgets.toArray(), [], []);
  const settings = useLiveQuery(() => db.settings.get('app'), [], undefined);

  useEffect(() => {
    void bootstrap().catch(() => {
      setToast({ message: '初始化失败，请刷新页面后重试。', tone: 'danger' });
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3_600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openNewExpense = () => {
    setEditingExpense(null);
    setFormOpen(true);
  };

  const openEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setFormOpen(true);
  };

  const notify = (message: string, tone: ToastState['tone'] = 'default') => {
    setToast({ message, tone });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">元</span>
          <span>
            <strong>元账</strong>
            <small>多币种记账</small>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={view === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => setView(item.id)}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-note">
          <CircleDollarSign size={20} aria-hidden="true" />
          <p>外币账单按录入时汇率永久保留，统计始终稳定。</p>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div>
            <p className="eyebrow">个人消费管理</p>
            <h1>{navItems.find((item) => item.id === view)?.label}</h1>
          </div>
          <button type="button" className="button primary add-button" onClick={openNewExpense}>
            <Plus size={18} aria-hidden="true" />
            记一笔
          </button>
        </header>

        <main className="main-content">
          {view === 'dashboard' && (
            <Dashboard
              expenses={expenses}
              categories={categories}
              budgets={budgets}
              defaultPeriod={settings?.defaultPeriod ?? 'month'}
              onAdd={openNewExpense}
              onEdit={openEditExpense}
              onViewAll={() => setView('transactions')}
            />
          )}
          {view === 'transactions' && (
            <Transactions
              expenses={expenses}
              categories={categories}
              onAdd={openNewExpense}
              onEdit={openEditExpense}
              notify={notify}
            />
          )}
          {view === 'budgets' && (
            <Budgets budgets={budgets} categories={categories} expenses={expenses} defaultPeriod={settings?.defaultPeriod ?? 'month'} notify={notify} />
          )}
          {view === 'settings' && (
            <SettingsPage notify={notify} />
          )}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="移动端主导航">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? 'mobile-nav-item active' : 'mobile-nav-item'}
              onClick={() => setView(item.id)}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button type="button" className="mobile-add" onClick={openNewExpense} aria-label="记一笔">
          <Plus size={25} aria-hidden="true" />
        </button>
      </nav>

      {formOpen && (
        <ExpenseForm
          expense={editingExpense}
          categories={categories}
          defaultCurrency={settings?.defaultCurrency ?? 'GBP'}
          onClose={() => setFormOpen(false)}
          onSaved={(message) => {
            setFormOpen(false);
            notify(message, 'success');
          }}
        />
      )}

      {toast && (
        <div className={`toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </div>
  );
}
