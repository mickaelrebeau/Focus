import {
  ArrowDataTransferHorizontalIcon,
  Camera01Icon,
  Coins01Icon,
  CreditCardIcon,
  FavouriteIcon,
  Mail01Icon,
  MoneyBag01Icon,
  PencilEdit01Icon,
} from '@hugeicons/core-free-icons'

// Icônes Hugeicons (gratuites) des types de conséquences, par clé de type.
// Le symbole stocké en base (consequence_types.icon) n'est plus affiché.
const CONSEQUENCE_ICONS: Record<string, typeof Coins01Icon> = {
  'credits': Coins01Icon,
  'donation': FavouriteIcon,
  'stripe': CreditCardIcon,
  'community-pot': MoneyBag01Icon,
  'random-user': ArrowDataTransferHorizontalIcon,
  'custom': PencilEdit01Icon,
  'mandatory-proof': Camera01Icon,
  'accountability-message': Mail01Icon,
}

export function consequenceIcon(type: string) {
  return CONSEQUENCE_ICONS[type] ?? Coins01Icon
}
