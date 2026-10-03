// Catalogues de démarrage par métier (prix indicatifs HTVA, à adapter par l'artisan).

import type { TradeId } from "../../content/fr";
import { newArticle } from "../defaults";
import type { Article, LineCategory } from "../types";
import { recalcAll } from "./pricing";

type Row = [ref: string, fr: string, nl: string, de: string, unit: string, purchase: number, margin: number, type: Article["type"], category: LineCategory, family: string];

const COMMON: Row[] = [["DEPL", "Déplacement", "Verplaatsing", "Anfahrt", "forfait", 25, 60, "labour", "labour", "Frais"]];

const ROWS: Record<TradeId, Row[]> = {
  plombier: [
    ["MO-PLB", "Main-d'œuvre plombier", "Arbeidsloon loodgieter", "Arbeitszeit Installateur", "h", 38, 45, "labour", "labour", "Main-d'œuvre"],
    ["BOIL-200", "Chauffe-eau électrique 200 L", "Elektrische boiler 200 L", "Elektro-Warmwasserspeicher 200 L", "u", 390, 30, "supply", "installed_material", "Sanitaire"],
    ["GRP-SEC", "Groupe de sécurité", "Veiligheidsgroep", "Sicherheitsgruppe", "u", 28, 50, "supply", "installed_material", "Sanitaire"],
    ["MIT-TH", "Mitigeur thermostatique douche", "Thermostatische douchemengkraan", "Thermostat-Duscharmatur", "u", 140, 40, "supply", "installed_material", "Sanitaire"],
    ["REC-90", "Receveur de douche extra-plat 90×120", "Extra platte douchebak 90×120", "Flache Duschwanne 90×120", "u", 260, 40, "supply", "installed_material", "Sanitaire"],
    ["PER-16", "Tube multicouche Ø16", "Meerlagenbuis Ø16", "Verbundrohr Ø16", "ml", 2.1, 80, "supply", "installed_material", "Tuyauterie"],
    ["ENT-CH", "Entretien annuel chaudière", "Jaarlijks onderhoud ketel", "Jährliche Kesselwartung", "forfait", 60, 80, "labour", "fossil_boiler_service", "Chauffage"],
    ["CH-GAZ", "Chaudière gaz à condensation 24 kW", "Condensatieketel gas 24 kW", "Gas-Brennwertkessel 24 kW", "u", 1650, 25, "supply", "fossil_boiler_install", "Chauffage"],
    ["PAC-8", "Pompe à chaleur air-eau 8 kW", "Lucht-water warmtepomp 8 kW", "Luft-Wasser-Wärmepumpe 8 kW", "u", 5200, 25, "supply", "heat_pump", "Chauffage"],
  ],
  electricien: [
    ["MO-ELE", "Main-d'œuvre électricien", "Arbeidsloon elektricien", "Arbeitszeit Elektriker", "h", 38, 45, "labour", "labour", "Main-d'œuvre"],
    ["TAB-3R", "Tableau électrique 3 rangées", "Verdeelkast 3 rijen", "Verteiler 3-reihig", "u", 95, 40, "supply", "installed_material", "Tableau"],
    ["DIF-30", "Différentiel 40 A 30 mA type A", "Differentieelschakelaar 40 A 30 mA type A", "FI-Schalter 40 A 30 mA Typ A", "u", 52, 40, "supply", "installed_material", "Tableau"],
    ["DISJ-16", "Disjoncteur 16 A", "Automaat 16 A", "Leitungsschutzschalter 16 A", "u", 8, 50, "supply", "installed_material", "Tableau"],
    ["PRISE", "Prise encastrée + pose", "Inbouwstopcontact + plaatsing", "Unterputz-Steckdose + Montage", "u", 9, 120, "supply", "installed_material", "Appareillage"],
    ["CAB-25", "Câble XVB 3G2,5", "Kabel XVB 3G2,5", "Kabel XVB 3G2,5", "ml", 1.4, 80, "supply", "installed_material", "Câblage"],
    ["RGIE", "Contrôle de conformité RGIE (organisme agréé)", "Keuring AREI (erkend organisme)", "AREI-Prüfung (zugelassene Stelle)", "forfait", 150, 20, "subcontract", "labour", "Contrôle"],
  ],
  peintre: [
    ["MO-PEI", "Main-d'œuvre peintre", "Arbeidsloon schilder", "Arbeitszeit Maler", "h", 34, 50, "labour", "labour", "Main-d'œuvre"],
    ["PREP-M", "Préparation murs (lessivage, rebouchage)", "Voorbereiding muren (afwassen, plamuren)", "Wandvorbereitung (Abwaschen, Spachteln)", "m²", 2, 150, "labour", "labour", "Préparation"],
    ["PEI-VEL", "Peinture acrylique velours 2 couches", "Acrylverf zijdeglans 2 lagen", "Acrylfarbe seidenmatt 2 Anstriche", "m²", 4.5, 150, "supply", "installed_material", "Peinture"],
    ["PEI-PLA", "Peinture plafond mate 2 couches", "Plafondverf mat 2 lagen", "Deckenfarbe matt 2 Anstriche", "m²", 4, 170, "supply", "installed_material", "Peinture"],
  ],
  macon: [
    ["MO-MAC", "Main-d'œuvre maçon", "Arbeidsloon metselaar", "Arbeitszeit Maurer", "h", 36, 45, "labour", "labour", "Main-d'œuvre"],
    ["BET-C25", "Béton C25/30 coulé", "Beton C25/30 gestort", "Beton C25/30 eingebaut", "m³", 120, 40, "supply", "installed_material", "Gros œuvre"],
    ["BLOC-14", "Bloc béton 14 cm maçonné", "Betonblok 14 cm gemetseld", "Betonstein 14 cm gemauert", "m²", 18, 90, "supply", "installed_material", "Gros œuvre"],
    ["TREIL", "Treillis soudé", "Wapeningsnet", "Baustahlmatte", "m²", 5, 50, "supply", "installed_material", "Gros œuvre"],
  ],
  menuisier: [
    ["MO-MEN", "Main-d'œuvre menuisier", "Arbeidsloon schrijnwerker", "Arbeitszeit Tischler", "h", 38, 45, "labour", "labour", "Main-d'œuvre"],
    ["FEN-PVC", "Fenêtre PVC double vitrage (fourniture)", "PVC-raam dubbel glas (levering)", "Kunststofffenster Doppelverglasung (Lieferung)", "u", 380, 35, "supply", "installed_material", "Châssis"],
    ["DEP-CH", "Dépose ancien châssis", "Verwijderen oud raam", "Ausbau altes Fenster", "u", 30, 100, "labour", "labour", "Châssis"],
    ["PARQ", "Parquet chêne posé", "Eiken parket geplaatst", "Eichenparkett verlegt", "m²", 32, 60, "supply", "installed_material", "Sols"],
  ],
  paysagiste: [
    ["MO-JAR", "Main-d'œuvre jardinier (entretien)", "Arbeidsloon tuinman (onderhoud)", "Arbeitszeit Gärtner (Pflege)", "h", 30, 50, "labour", "garden_maintenance", "Entretien"],
    ["TONTE", "Tonte de pelouse", "Gazon maaien", "Rasen mähen", "m²", 0.08, 100, "labour", "garden_maintenance", "Entretien"],
    ["TAILLE", "Taille de haies", "Hagen snoeien", "Heckenschnitt", "ml", 1.5, 80, "labour", "garden_maintenance", "Entretien"],
    ["TERRE", "Terre arable criblée livrée et étalée", "Gezeefde teelaarde geleverd en verspreid", "Gesiebter Mutterboden geliefert und verteilt", "m³", 28, 70, "supply", "garden_creation", "Aménagement"],
    ["GAZ-ROUL", "Gazon en rouleaux posé", "Graszoden gelegd", "Rollrasen verlegt", "m²", 5.5, 100, "supply", "garden_creation", "Aménagement"],
    ["PAILLIS", "Paillis d'écorces (couche 7 cm)", "Boomschorsmulch (laag 7 cm)", "Rindenmulch (7 cm Schicht)", "m³", 35, 60, "supply", "garden_creation", "Aménagement"],
    ["PAVE-TER", "Pavés de terrasse posés sur empierrement", "Terrasklinkers gelegd op steenslag", "Terrassenpflaster auf Schotter verlegt", "m²", 42, 85, "supply", "garden_creation", "Aménagement"],
    ["EMPIER", "Empierrement 0/32 compacté", "Steenslag 0/32 verdicht", "Schotter 0/32 verdichtet", "m³", 30, 70, "supply", "garden_creation", "Aménagement"],
  ],
};

export function starterCatalog(trade: TradeId): Article[] {
  return recalcAll(
    [...ROWS[trade], ...COMMON].map(([ref, fr, nl, de, unit, purchasePrice, marginPercent, type, category, family]) => newArticle({ ref, name: { fr, nl, de }, unit, purchasePrice, marginPercent, type, category, family, trade })),
  );
}
