import {
  BookOpen,
  Bus,
  CircleEllipsis,
  Cross,
  Dumbbell,
  Film,
  House,
  Plane,
  ShoppingBag,
  ShoppingBasket,
  Utensils,
  Zap
} from 'lucide-react';

const icons = {
  food: Utensils,
  transport: Bus,
  groceries: ShoppingBasket,
  housing: House,
  utilities: Zap,
  shopping: ShoppingBag,
  travel: Plane,
  entertainment: Film,
  health: Cross,
  education: BookOpen,
  other: CircleEllipsis,
  default: Dumbbell
};

export default function CategoryIcon({ icon, size = 18 }: { icon: string; size?: number }) {
  const Icon = icons[icon as keyof typeof icons] ?? icons.default;
  return <Icon size={size} aria-hidden="true" />;
}
