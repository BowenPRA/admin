/* eslint-disable react-refresh/only-export-components */
import {
  Calculator, FlaskConical, BookOpen, Palette, Landmark, Brain, Monitor, HeartPulse, Sun, ListChecks, Sparkles,
  Lightbulb, Flag, Smile, Users, UserRound, Rocket, Shuffle, Music, Dumbbell, Globe, Languages, Drama, Leaf, Star, Compass,
} from 'lucide-react'

// Icon names that can be chosen for subjects and learner skills in Settings.
export const ICONS = {
  calculator: Calculator, flask: FlaskConical, book: BookOpen, palette: Palette, landmark: Landmark, brain: Brain,
  monitor: Monitor, heart: HeartPulse, sun: Sun, list: ListChecks, sparkles: Sparkles, lightbulb: Lightbulb, flag: Flag,
  smile: Smile, users: Users, user: UserRound, rocket: Rocket, shuffle: Shuffle, music: Music, dumbbell: Dumbbell,
  globe: Globe, languages: Languages, drama: Drama, leaf: Leaf, star: Star, compass: Compass,
}

export function Icon({ name, size = 16, ...rest }) {
  const C = ICONS[name] || Star
  return <C size={size} {...rest} />
}
