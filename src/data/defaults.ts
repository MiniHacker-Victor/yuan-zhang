import type { AppSettings, Category } from '../types';

const now = new Date().toISOString();

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: '餐饮', icon: ' utensils', color: '#e76f51', sortOrder: 10, archived: false, createdAt: now },
  { id: 'transport', name: '交通', icon: 'transport', color: '#2a9d8f', sortOrder: 20, archived: false, createdAt: now },
  { id: 'groceries', name: '超市', icon: 'groceries', color: '#6a994e', sortOrder: 30, archived: false, createdAt: now },
  { id: 'housing', name: '住房', icon: 'housing', color: '#457b9d', sortOrder: 40, archived: false, createdAt: now },
  { id: 'utilities', name: '水电通讯', icon: 'utilities', color: '#577590', sortOrder: 50, archived: false, createdAt: now },
  { id: 'shopping', name: '购物', icon: 'shopping', color: '#bc6c25', sortOrder: 60, archived: false, createdAt: now },
  { id: 'travel', name: '旅行', icon: 'travel', color: '#00a6a6', sortOrder: 70, archived: false, createdAt: now },
  { id: 'entertainment', name: '娱乐', icon: 'entertainment', color: '#9d4edd', sortOrder: 80, archived: false, createdAt: now },
  { id: 'health', name: '健康', icon: 'health', color: '#e63946', sortOrder: 90, archived: false, createdAt: now },
  { id: 'education', name: '教育', icon: 'education', color: '#3a86ff', sortOrder: 100, archived: false, createdAt: now },
  { id: 'other', name: '其他', icon: 'other', color: '#7d8597', sortOrder: 110, archived: false, createdAt: now }
];

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  defaultCurrency: 'GBP',
  defaultPeriod: 'month',
  schemaVersion: 2
};
