/** QA del nombre que se ve en una conversación (el helper, con sus casos). */
import { nombreParaMostrar, esNombrePlaceholder } from '../src/components/admin/crm/whatsapp/nombre-conversacion.ts';
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);
paso('Un nombre de persona se respeta', nombreParaMostrar({ nombre: 'Mario barranco' }, { nombre: 'Tortillerías' }, '+522215627300') === 'Mario barranco');
paso('«WhatsApp 7300» con empresa enseña la empresa', nombreParaMostrar({ nombre: 'WhatsApp 7300' }, { nombre: 'Tortillerias El Progreso' }, '+522215627300') === 'Tortillerias El Progreso');
paso('Prefiere el nombre comercial', nombreParaMostrar({ nombre: 'Contacto 1234' }, { nombre: 'Razón Social SA', nombre_comercial: 'Lily Boutique' }) === 'Lily Boutique');
paso('Sin empresa, se queda el placeholder', nombreParaMostrar({ nombre: 'WhatsApp 7300' }, null, '+522215627300') === 'WhatsApp 7300');
paso('Sin nada, el teléfono legible', /22 1562 7300/.test(nombreParaMostrar(null, null, '+522215627300')));
paso('Un nombre con número NO es placeholder', !esNombrePlaceholder('Carlos 2'));
paso('«WhatsApp 7300» sí lo es', esNombrePlaceholder('WhatsApp 7300'));
