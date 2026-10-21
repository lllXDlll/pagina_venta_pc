import { cargarEnvLocal } from '../src/config/cargar-env.js';

// En local, las pruebas e2e usan el .env de la raíz (Docker); en CI, las variables del job.
cargarEnvLocal();
