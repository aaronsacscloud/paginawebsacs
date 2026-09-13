-- 13-sep-2026 · Los objetivos de los correos de marcas ya no llevan la pista de
-- «si vende joyería…»: en la prueba con una marca de ROPA (BÁSICOS DE MODA) la
-- IA la tomó como orden y quitó las tallas de los ocho correos. La decisión
-- se toma ahora en el expediente por el subgiro (abm-generar.ts, sinTalla).
update abm_plantillas
   set objetivo = replace(objetivo, ' (si vende joyería, bolsas, sombreros o accesorios: modelo y color, nunca tallas)', '')
 where giro = 'marcas' and objetivo like '%nunca tallas)%';
