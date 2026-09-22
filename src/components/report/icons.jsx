/* eslint-disable react-refresh/only-export-components */
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import {
  Calculator, FlaskConical, BookOpen, Palette, Landmark, Brain, Monitor, HeartPulse, Sun, ListChecks, Sparkles,
  Lightbulb, Flag, Smile, Users, UserRound, Rocket, Shuffle, Music, Dumbbell, Globe, Languages, Drama, Leaf, Star, Compass,
  PersonStanding, ChartColumnIncreasing, Quote, Award, ChefHat, Brush, Hammer, Sprout, Puzzle, Mic,
  MessageCircle, Ear, Hand, Scissors, Handshake, Footprints, Shapes, Blocks,
} from 'lucide-react'

// Icon names that can be chosen for subjects and learner skills in Settings.
export const ICONS = {
  calculator: Calculator, flask: FlaskConical, book: BookOpen, palette: Palette, landmark: Landmark, brain: Brain,
  monitor: Monitor, heart: HeartPulse, sun: Sun, list: ListChecks, sparkles: Sparkles, lightbulb: Lightbulb, flag: Flag,
  smile: Smile, users: Users, user: UserRound, rocket: Rocket, shuffle: Shuffle, music: Music, dumbbell: Dumbbell,
  globe: Globe, languages: Languages, drama: Drama, leaf: Leaf, star: Star, compass: Compass, movement: PersonStanding,
  chef: ChefHat, brush: Brush, hammer: Hammer, sprout: Sprout, puzzle: Puzzle, mic: Mic,
  chat: MessageCircle, ear: Ear, hand: Hand, scissors: Scissors, handshake: Handshake, footprints: Footprints, shapes: Shapes, blocks: Blocks,
}

export function Icon({ name, size = 16, ...rest }) {
  const C = ICONS[name] || Star
  return <C size={size} {...rest} />
}

// Icons the PDF uses for its own headings (not offered in Settings).
const PDF_ICONS = { chart: ChartColumnIncreasing, quote: Quote, award: Award }

let svgs = null
/**
 * Every icon as SVG markup for drawing into the PDF, stroked in #163a63 (the
 * layout swaps that colour for the one it needs).
 */
export function iconSvgs() {
  if (svgs) return svgs
  const el = document.createElement('div')
  const root = createRoot(el)
  const out = {}
  for (const [name, C] of Object.entries({ ...ICONS, ...PDF_ICONS })) {
    flushSync(() => root.render(<C size={24} color="#163a63" strokeWidth={2.2} />))
    out[name] = el.innerHTML
  }
  root.unmount()
  svgs = out
  return svgs
}
