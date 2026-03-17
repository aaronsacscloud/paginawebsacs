export interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}

export interface FAQ {
  question: string;
  answer: string;
}

export const plans: Plan[] = [];

export const faqs: FAQ[] = [];
