# Regras para agentes (Cline/assistentes)

Estas regras valem para qualquer task neste repositório.

## Execução de comandos

1. **NÃO executar `npm run dev` automaticamente ao finalizar tasks.**
2. **NÃO iniciar comandos long-running por padrão** (ex.: `npm run dev`, `vite`, `nodemon`, `ts-node-dev`, `watch`, `tail -f`).
3. Só executar comando que fica ativo continuamente se o usuário pedir **explicitamente**.
4. Ao concluir uma task, preferir comandos de verificação que encerram sozinhos (ex.: build, test, lint), quando necessário.

## Entrega final

- Evitar deixar terminal preso com processo em execução contínua.
- Se houver necessidade real de servidor local, perguntar antes e explicar que o processo ficará ativo até interrupção manual.
