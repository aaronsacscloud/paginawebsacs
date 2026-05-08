// Mapa de traducciones para los compromisos canónicos del partner.
// Las invitaciones guardan compromisos en español en la columna JSON
// `partner_invitations.compromisos`. Este map intercepta por título
// canónico y devuelve la versión traducida; si no hay match, fallback ES.

import type { Lang } from './content-types-i18n-types';

interface CompromisoTr { title: string; detail: string; frequency: string; ctaLabel?: string }

// Indexado por título canónico ES.
export const COMPROMISO_I18N: Record<Lang, Record<string, CompromisoTr>> = {
  es: {},

  en: {
    'Cuota mínima anual de 10 sucursales': {
      title: 'Annual minimum quota of 10 stores',
      detail: 'Minimum 10 active stores sold on any plan during the first 12 months. Can be 10 clients with 1 store each, 1 client with 10 stores, or any combination. This is what makes the program sustainable for both sides.',
      frequency: 'Annual',
    },
    'Generar 100 puntos al mes con contenido o acciones': {
      title: 'Earn 100 points per month with content or actions',
      detail: 'Each month you accumulate at least 100 points in three possible ways: published content, promotional actions (demos, events, reviews, intros) or philanthropic activities (shelters, kitchens, mentoring, volunteering). You don\'t have to be only a creator — supporting also counts. You upload each action from your partner panel; without a report no points are credited. If you exceed 100 in a month, the surplus carries over.',
      frequency: 'Monthly · 100 pts',
      ctaLabel: 'See the full points catalog →',
    },
    'Reportar tu actividad en el portal': {
      title: 'Report your activity on the portal',
      detail: 'Upload the link, photo or evidence of each action (content, support or philanthropy) from the "Report activity" tab on your panel. SACS admin validates and awards the points.',
      frequency: 'Per action',
    },
    'Difusión: en tus redes o las del canal SACS': {
      title: 'Distribution: on your channels or the SACS channel',
      detail: 'There are two ways to distribute and both count. You publish the content on your own channels (Instagram, TikTok, YouTube or LinkedIn) or you send us the original files so we publish them from the SACS channel and multiply reach. What matters is that it gets out — and distribution earns you more visits to your link, more demos booked and more commission.',
      frequency: 'Ongoing',
    },
    'Cuidar la marca SACS': {
      title: 'Care for the SACS brand',
      detail: 'What you publish as an ambassador adds to or subtracts from the brand. Polished production, messages aligned with the manual, no unnecessary controversy, respect for competitors, clients and community. If in doubt, we review it together before publishing.',
      frequency: 'Ongoing',
    },
    'Uso correcto del logotipo y tipografías': {
      title: 'Correct use of logo and typography',
      detail: 'Apply the SACS logo only in its official version. Respect typography, palette and guidelines from the brand manual.',
      frequency: 'Ongoing',
    },
  },

  fr: {
    'Cuota mínima anual de 10 sucursales': {
      title: 'Quota annuel minimum de 10 boutiques',
      detail: 'Minimum 10 boutiques actives vendues sur n\'importe quel plan durant les 12 premiers mois. Cela peut être 10 clients avec 1 boutique chacun, 1 client avec 10 boutiques, ou toute combinaison. C\'est ce qui rend le programme durable des deux côtés.',
      frequency: 'Annuel',
    },
    'Generar 100 puntos al mes con contenido o acciones': {
      title: 'Gagner 100 points par mois avec du contenu ou des actions',
      detail: 'Chaque mois vous accumulez au moins 100 points de trois façons possibles : contenu publié, actions de promotion (démos, événements, avis, introductions) ou activités philanthropiques (refuges, cantines, mentorat, bénévolat). Vous n\'êtes pas obligé d\'être uniquement créateur — soutenir compte aussi. Vous téléchargez chaque action depuis votre portail partenaire ; sans rapport, pas de points crédités. Si vous dépassez 100, le surplus est reporté.',
      frequency: 'Mensuel · 100 pts',
      ctaLabel: 'Voir le catalogue complet de points →',
    },
    'Reportar tu actividad en el portal': {
      title: 'Rapporter votre activité sur le portail',
      detail: 'Téléchargez le lien, la photo ou la preuve de chaque action (contenu, soutien ou philanthropie) depuis l\'onglet « Rapporter activité » sur votre portail. L\'admin SACS valide et attribue les points.',
      frequency: 'Par action',
    },
    'Difusión: en tus redes o las del canal SACS': {
      title: 'Diffusion : sur vos canaux ou ceux du canal SACS',
      detail: 'Il y a deux façons de diffuser et les deux comptent. Vous publiez le contenu sur vos propres canaux (Instagram, TikTok, YouTube ou LinkedIn) ou vous nous envoyez les fichiers originaux pour que nous les publiions depuis le canal SACS et multiplions la portée. Ce qui compte, c\'est que ça soit diffusé — et la diffusion vous apporte plus de visites sur votre lien, plus de démos et plus de commission.',
      frequency: 'Continu',
    },
    'Cuidar la marca SACS': {
      title: 'Prendre soin de la marque SACS',
      detail: 'Ce que vous publiez en tant qu\'ambassadeur ajoute ou soustrait à la marque. Production soignée, messages alignés au manuel, sans controverse inutile, respect des concurrents, clients et communauté. En cas de doute, nous le revoyons ensemble avant publication.',
      frequency: 'Continu',
    },
    'Uso correcto del logotipo y tipografías': {
      title: 'Usage correct du logo et de la typographie',
      detail: 'Appliquez le logo SACS uniquement dans sa version officielle. Respectez la typographie, la palette et les règles du manuel de marque.',
      frequency: 'Continu',
    },
  },

  it: {
    'Cuota mínima anual de 10 sucursales': {
      title: 'Quota minima annua di 10 negozi',
      detail: 'Minimo 10 negozi attivi venduti su qualsiasi piano nei primi 12 mesi. Possono essere 10 clienti con 1 negozio ciascuno, 1 cliente con 10 negozi, o qualsiasi combinazione. Questo rende il programma sostenibile per entrambe le parti.',
      frequency: 'Annuale',
    },
    'Generar 100 puntos al mes con contenido o acciones': {
      title: 'Guadagnare 100 punti al mese con contenuti o azioni',
      detail: 'Ogni mese accumuli almeno 100 punti in tre modi possibili: contenuti pubblicati, azioni di promozione (demo, eventi, recensioni, introduzioni) o attività filantropiche (rifugi, mense, mentoring, volontariato). Non devi essere solo creator — anche supportare conta. Carichi ogni azione dal tuo pannello partner; senza report niente punti accreditati. Se superi i 100 nel mese, l\'eccedenza si riporta al successivo.',
      frequency: 'Mensile · 100 pts',
      ctaLabel: 'Vedi il catalogo completo di punti →',
    },
    'Reportar tu actividad en el portal': {
      title: 'Segnala la tua attività sul portale',
      detail: 'Carica il link, la foto o l\'evidenza di ogni azione (contenuti, supporto o filantropia) dalla tab "Segnala attività" del tuo pannello. L\'admin SACS valida e assegna i punti.',
      frequency: 'Per azione',
    },
    'Difusión: en tus redes o las del canal SACS': {
      title: 'Diffusione: sui tuoi canali o sul canale SACS',
      detail: 'Ci sono due modi di diffondere e contano entrambi. Pubblichi i contenuti sui tuoi canali (Instagram, TikTok, YouTube o LinkedIn) o ci invii i file originali così li pubblichiamo dal canale SACS moltiplicando la portata. L\'importante è che si diffonda — e la diffusione ti porta più visite al link, più demo e più commissioni.',
      frequency: 'Continuativo',
    },
    'Cuidar la marca SACS': {
      title: 'Curare il brand SACS',
      detail: 'Quello che pubblichi come ambasciatore aggiunge o toglie al brand. Produzione curata, messaggi allineati al manuale, senza polemiche inutili, rispetto per concorrenti, clienti e comunità. Se hai dubbi, lo rivediamo insieme prima di pubblicare.',
      frequency: 'Continuativo',
    },
    'Uso correcto del logotipo y tipografías': {
      title: 'Uso corretto del logo e della tipografia',
      detail: 'Applicare il logo SACS solo nella sua versione ufficiale. Rispettare tipografia, palette e linee guida del manuale di brand.',
      frequency: 'Continuativo',
    },
  },

  pt: {
    'Cuota mínima anual de 10 sucursales': {
      title: 'Cota mínima anual de 10 lojas',
      detail: 'Mínimo 10 lojas ativas vendidas em qualquer plano durante os primeiros 12 meses. Podem ser 10 clientes com 1 loja cada, 1 cliente com 10 lojas ou qualquer combinação. É o que torna o programa sustentável para os dois lados.',
      frequency: 'Anual',
    },
    'Generar 100 puntos al mes con contenido o acciones': {
      title: 'Ganhar 100 pontos por mês com conteúdo ou ações',
      detail: 'Cada mês você acumula no mínimo 100 pontos em três formas possíveis: conteúdo publicado, ações de promoção (demos, eventos, avaliações, intros) ou atividades filantrópicas (abrigos, refeitórios, mentorias, voluntariado). Você não precisa ser só criador — apoiar também soma. Cada ação você sobe do seu painel de parceiro; sem reporte não há pontos creditados. Se passar de 100 no mês, o excedente acumula no próximo.',
      frequency: 'Mensal · 100 pts',
      ctaLabel: 'Ver o catálogo completo de pontos →',
    },
    'Reportar tu actividad en el portal': {
      title: 'Reportar sua atividade no portal',
      detail: 'Suba o link, foto ou evidência de cada ação (conteúdo, apoio ou filantropia) na aba "Reportar atividade" do seu painel. Admin SACS valida e atribui os pontos.',
      frequency: 'Por ação',
    },
    'Difusión: en tus redes o las del canal SACS': {
      title: 'Difusão: nas suas redes ou nas do canal SACS',
      detail: 'Há duas formas de difundir e ambas contam. Você publica o conteúdo nas suas próprias redes (Instagram, TikTok, YouTube ou LinkedIn) ou nos envia os arquivos originais para que publiquemos pelo canal SACS e multipliquemos o alcance. O importante é que se difunda — e a difusão te traz mais visitas ao seu link, mais demos e mais comissão.',
      frequency: 'Contínuo',
    },
    'Cuidar la marca SACS': {
      title: 'Cuidar da marca SACS',
      detail: 'O que você publica como embaixador soma ou subtrai à marca. Produção cuidada, mensagens alinhadas ao manual, sem polêmicas desnecessárias, respeito a concorrentes, clientes e comunidade. Se tiver dúvida, revisamos juntos antes de publicar.',
      frequency: 'Contínuo',
    },
    'Uso correcto del logotipo y tipografías': {
      title: 'Uso correto do logo e tipografia',
      detail: 'Aplicar o logo SACS apenas em sua versão oficial. Respeitar tipografia, paleta e diretrizes do manual de marca.',
      frequency: 'Contínuo',
    },
  },
};
