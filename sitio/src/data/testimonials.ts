export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  location: string;
}

export interface CaseStudy extends Testimonial {
  industry: string;
  challenge: string;
  result: string;
  stat: string;
  statLabel: string;
}

export const testimonials: Testimonial[] = [];

export const caseStudies: CaseStudy[] = [];
