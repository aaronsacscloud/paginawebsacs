// Traducciones de los 5 cursos de certificación: shortName, descripcion,
// nivel y serviceUnit en 4 idiomas. ES sigue como fuente en certifications.ts.

import type { Lang } from './content-types-i18n-types';

export const CERT_I18N: Record<Lang, Record<string, {
  shortName: string;
  descripcion: string;
  nivel: string;
  duracion: string;
  serviceUnit: string;
}>> = {
  es: {},

  en: {
    impl_una_sucursal: {
      shortName: 'Implementation · 1 store',
      descripcion: 'Master the full SACS setup for a single-store business: products, inventory, POS, electronic invoicing and team training.',
      nivel: 'Beginner',
      duracion: '4 hours live + materials',
      serviceUnit: '/ implementation',
    },
    impl_multisucursal: {
      shortName: 'Implementation · Multi-store',
      descripcion: 'Specialize in multi-store businesses: architecture, consolidation, transfers between stores, role-based access control, HQ reporting and operating at scale.',
      nivel: 'Intermediate / Advanced',
      duracion: '10 hours live + case studies + mentoring',
      serviceUnit: '/ implementation',
    },
    migracion_datos: {
      shortName: 'Data migration',
      descripcion: 'Specialization in migrating client data into SACS — products, inventory, customers, historical sales and catalogs — from Excel, Aspel, Microsip or other systems, without losing a single record.',
      nivel: 'Specialization',
      duracion: '6 hours live + templates + exercises',
      serviceUnit: '/ migration',
    },
    ia_automatizacion: {
      shortName: 'AI automation',
      descripcion: 'Learn to use the SACS AI module (Axo Copilot and agent orchestrator) to automate your client\'s repetitive processes: product onboarding, WhatsApp service, inventory replenishment, collections and reports.',
      nivel: 'Advanced',
      duracion: '12 hours live + workshops + mentoring',
      serviceUnit: '/ project',
    },
    consultor_ia: {
      shortName: 'AI consultant',
      descripcion: 'Learn to read your client\'s data with AI, interpret it together with them and deliver an executive report every 30 days. It\'s a recurring service — a monthly retainer with the client.',
      nivel: 'Senior',
      duracion: '14 hours live + real cases + ongoing mentoring',
      serviceUnit: '/ month recurring',
    },
  },

  fr: {
    impl_una_sucursal: {
      shortName: 'Implémentation · 1 boutique',
      descripcion: 'Maîtrisez la configuration complète de SACS pour une activité mono-boutique : produits, inventaire, POS, facturation électronique et formation de l\'équipe.',
      nivel: 'Débutant',
      duracion: '4 heures en direct + supports',
      serviceUnit: '/ implémentation',
    },
    impl_multisucursal: {
      shortName: 'Implémentation · Multi-boutiques',
      descripcion: 'Spécialisez-vous dans les activités multi-boutiques : architecture, consolidation, transferts entre boutiques, contrôle d\'accès par rôle, reporting HQ et opération à l\'échelle.',
      nivel: 'Intermédiaire / Avancé',
      duracion: '10 heures en direct + cas pratiques + mentorat',
      serviceUnit: '/ implémentation',
    },
    migracion_datos: {
      shortName: 'Migration de données',
      descripcion: 'Spécialisation pour migrer les données client vers SACS — produits, inventaire, clients, ventes historiques et catalogues — depuis Excel, Aspel, Microsip ou d\'autres systèmes, sans perdre un seul enregistrement.',
      nivel: 'Spécialisation',
      duracion: '6 heures en direct + modèles + exercices',
      serviceUnit: '/ migration',
    },
    ia_automatizacion: {
      shortName: 'Automatisation IA',
      descripcion: 'Apprenez à utiliser le module IA de SACS (Axo Copilot et orchestrateur d\'agents) pour automatiser les processus répétitifs du client : ajout de produits, service WhatsApp, réapprovisionnement, recouvrement et rapports.',
      nivel: 'Avancé',
      duracion: '12 heures en direct + workshops + mentorat',
      serviceUnit: '/ projet',
    },
    consultor_ia: {
      shortName: 'Consultant IA',
      descripcion: 'Apprenez à lire les données du client avec l\'IA, à les interpréter avec lui et à livrer un rapport exécutif tous les 30 jours. C\'est un service récurrent — un retainer mensuel avec le client.',
      nivel: 'Senior',
      duracion: '14 heures en direct + cas réels + mentorat continu',
      serviceUnit: '/ mois récurrent',
    },
  },

  it: {
    impl_una_sucursal: {
      shortName: 'Implementazione · 1 negozio',
      descripcion: 'Padroneggia il setup completo di SACS per un\'attività con un solo negozio: prodotti, inventario, POS, fatturazione elettronica e formazione del team.',
      nivel: 'Principiante',
      duracion: '4 ore live + materiali',
      serviceUnit: '/ implementazione',
    },
    impl_multisucursal: {
      shortName: 'Implementazione · Multi-negozio',
      descripcion: 'Specializzati in attività multi-negozio: architettura, consolidamento, trasferimenti tra negozi, controllo accessi per ruolo, reporting HQ e operatività a scala.',
      nivel: 'Intermedio / Avanzato',
      duracion: '10 ore live + casi pratici + mentoring',
      serviceUnit: '/ implementazione',
    },
    migracion_datos: {
      shortName: 'Migrazione dati',
      descripcion: 'Specializzazione nel migrare i dati del cliente verso SACS — prodotti, inventario, clienti, vendite storiche e cataloghi — da Excel, Aspel, Microsip o altri sistemi, senza perdere un singolo record.',
      nivel: 'Specializzazione',
      duracion: '6 ore live + template + esercizi',
      serviceUnit: '/ migrazione',
    },
    ia_automatizacion: {
      shortName: 'Automazione con IA',
      descripcion: 'Impara a usare il modulo IA di SACS (Axo Copilot e orchestratore di agenti) per automatizzare i processi ripetitivi del cliente: caricamento prodotti, assistenza WhatsApp, riapprovvigionamento, riscossioni e report.',
      nivel: 'Avanzato',
      duracion: '12 ore live + workshop + mentoring',
      serviceUnit: '/ progetto',
    },
    consultor_ia: {
      shortName: 'Consulente IA',
      descripcion: 'Impara a leggere i dati del cliente con l\'IA, interpretarli insieme a lui e consegnare un report executive ogni 30 giorni. È un servizio ricorrente — un retainer mensile con il cliente.',
      nivel: 'Senior',
      duracion: '14 ore live + casi reali + mentoring continuativo',
      serviceUnit: '/ mese ricorrente',
    },
  },

  pt: {
    impl_una_sucursal: {
      shortName: 'Implementação · 1 loja',
      descripcion: 'Domine o setup completo da SACS para um negócio de uma só loja: produtos, inventário, POS, nota fiscal eletrônica e treinamento da equipe.',
      nivel: 'Iniciante',
      duracion: '4 horas ao vivo + materiais',
      serviceUnit: '/ implementação',
    },
    impl_multisucursal: {
      shortName: 'Implementação · Multi-loja',
      descripcion: 'Especialize-se em negócios multi-loja: arquitetura, consolidação, transferências entre lojas, controle de acesso por papel, relatórios HQ e operação em escala.',
      nivel: 'Intermediário / Avançado',
      duracion: '10 horas ao vivo + casos práticos + mentoria',
      serviceUnit: '/ implementação',
    },
    migracion_datos: {
      shortName: 'Migração de dados',
      descripcion: 'Especialização em migrar dados do cliente para a SACS — produtos, inventário, clientes, vendas históricas e catálogos — de Excel, Aspel, Microsip ou outros sistemas, sem perder um único registro.',
      nivel: 'Especialização',
      duracion: '6 horas ao vivo + templates + exercícios',
      serviceUnit: '/ migração',
    },
    ia_automatizacion: {
      shortName: 'Automação com IA',
      descripcion: 'Aprenda a usar o módulo de IA da SACS (Axo Copilot e orquestrador de agentes) para automatizar processos repetitivos do cliente: cadastro de produtos, atendimento WhatsApp, reposição, cobrança e relatórios.',
      nivel: 'Avançado',
      duracion: '12 horas ao vivo + workshops + mentoria',
      serviceUnit: '/ projeto',
    },
    consultor_ia: {
      shortName: 'Consultor em IA',
      descripcion: 'Aprenda a ler os dados do cliente com IA, interpretá-los junto com ele e entregar um relatório executivo a cada 30 dias. É um serviço recorrente — um retainer mensal com o cliente.',
      nivel: 'Sênior',
      duracion: '14 horas ao vivo + casos reais + mentoria contínua',
      serviceUnit: '/ mês recorrente',
    },
  },
};
