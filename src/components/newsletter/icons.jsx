/* eslint-disable react-refresh/only-export-components */
import {
  BookOpen, Pencil, FlaskConical, Microscope, Calculator, Globe, Languages, Palette, Paintbrush, Music, Drama, Mic,
  CookingPot, Apple, Sprout, Leaf, Flower2, TreePalm, Sun, CloudRain, Waves, Bus, MapPin, Ticket,
  Trophy, Medal, Star, PartyPopper, Gift, CakeSlice, Ghost, Moon, Lamp, Heart, HandHeart, Users,
  CalendarDays, Clock, CreditCard, ClipboardList, Megaphone, Camera, Dumbbell, Bike, Puzzle, Lightbulb, Rocket, Smile,
  Images, Quote, PenLine, Pin,
} from 'lucide-react'

// The icons a newsletter part can wear (constants.js STORY_ICONS), plus the ones
// the part types use. One list for the editor and its website preview.
export const NL_ICONS = {
  'book-open': BookOpen, pencil: Pencil, 'flask-conical': FlaskConical, microscope: Microscope, calculator: Calculator, globe: Globe,
  languages: Languages, palette: Palette, paintbrush: Paintbrush, music: Music, drama: Drama, mic: Mic,
  'cooking-pot': CookingPot, apple: Apple, sprout: Sprout, leaf: Leaf, 'flower-2': Flower2, 'tree-palm': TreePalm,
  sun: Sun, 'cloud-rain': CloudRain, waves: Waves, bus: Bus, 'map-pin': MapPin, ticket: Ticket,
  trophy: Trophy, medal: Medal, star: Star, 'party-popper': PartyPopper, gift: Gift, 'cake-slice': CakeSlice,
  ghost: Ghost, moon: Moon, lamp: Lamp, heart: Heart, 'hand-heart': HandHeart, users: Users,
  'calendar-days': CalendarDays, clock: Clock, 'credit-card': CreditCard, 'clipboard-list': ClipboardList, megaphone: Megaphone, camera: Camera,
  dumbbell: Dumbbell, bike: Bike, puzzle: Puzzle, lightbulb: Lightbulb, rocket: Rocket, smile: Smile,
  images: Images, quote: Quote, 'pen-line': PenLine, pin: Pin,
}

export function NlIcon({ name, size = 18, ...rest }) {
  const C = NL_ICONS[name] || BookOpen
  return <C size={size} {...rest} />
}
