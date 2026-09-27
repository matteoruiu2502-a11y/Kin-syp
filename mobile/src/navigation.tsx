import { createContext, useContext } from 'react';

/** Navigation minimale à 3 écrans : pas de pile, l'écran de mesure est l'accueil. */
export type Screen = 'measure' | 'patients' | 'report';

export const NavigationContext = createContext<(screen: Screen) => void>(() => {});

export function useNavigate(): (screen: Screen) => void {
  return useContext(NavigationContext);
}
