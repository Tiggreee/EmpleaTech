# Lecciones

Cada vuelta al proyecto deja de 3 a 5 lecciones: qué falló, qué costó de más y qué funcionó. Son la evidencia del
siguiente plan.

## 2026-10-12 · De «ya está en producción» a usarla de verdad

- **El CI estuvo en rojo tres días y nadie lo vio**, porque Vercel despliega aunque GitHub falle. Revisar el CI es parte
  de decir «está listo».
- **Un parche escondía la causa.** La config de Playwright tronaba con solo leerse; la solución fue validar la base al
  correr las pruebas, no al cargar la config. Antes de mergear un arreglo, preguntar qué arregla de raíz.
- **Una prueba fallaba 1 de cada ~1000 veces** porque «alteraba» datos aleatorios con un valor fijo. Una prueba no debe
  depender del azar.
- **La app preguntaba lo que el CV ya decía** (años, inglés). Antes de pedirle algo a la persona, sacarlo de lo que ya
  dio; lo que declare a mano manda, y en un formulario nunca se afirma más de lo que el CV o la persona dicen.
- **Semanas construyendo y cero postulaciones.** La métrica que importa (respuestas, entrevistas) no se mueve sin uso
  real: primero se usa y se mide, después se construye.
