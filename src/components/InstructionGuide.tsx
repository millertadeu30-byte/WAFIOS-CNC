/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export default function InstructionGuide() {
  return (
    <div className="text-slate-300 text-xs leading-relaxed" id="instruction-guide">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="guide-grid">
        <div className="space-y-3">
          <h4 className="text-slate-200 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Entendendo os Eixos de Movimento
          </h4>
          <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
            <li>
              <strong className="text-slate-300">Avanço (L):</strong> Comprimento do fio alimentado para fora do bocal antes do próximo movimento. É o comprimento total do segmento de fio (medido em milímetros).
            </li>
            <li>
              <strong className="text-slate-300">Giro / Torção (AP):</strong> Representa o ângulo em graus (A-axis) pelo qual o cabeçote ou alimentador rotaciona o fio em seu próprio eixo longitudinal para mudar o <span className="text-sky-400">plano de dobra</span>.
            </li>
            <li>
              <strong className="text-slate-300">Ângulo de Dobra (AC):</strong> Ângulo de giro do pino de dobra. Valores positivos dobram o fio para a <span className="text-emerald-400 font-semibold">Direita</span> e valores negativos para a <span className="text-indigo-400 font-semibold">Esquerda</span>.
            </li>
          </ul>

          <h4 className="text-slate-200 font-semibold flex items-center gap-1 pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            A Importância do &quot;Ponto de Partida&quot;
          </h4>
          <p className="text-slate-400">
            Para garantir que você nunca perca a orientação da peça, o visualizador 3D fixa o <span className="text-slate-200 font-semibold">Bocal de Saída (Origem 0,0,0)</span>. 
            Conforme você edita a tabela, o fio é simulado sendo empurrado para frente a partir deste bocal. Isso replica fielmente a visão física do operador em frente à máquina!
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-slate-200 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Modos de Rotação AP (Absoluto vs. Relativo)
          </h4>
          <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <p className="text-[11px]">
              <span className="text-amber-400 font-bold">Modo Absoluto (Padrão WAFIOS):</span> Cada valor de AP define a rotação exata dos rolos em relação à posição zero inicial da máquina. Se o Passo 2 tem AP = -90 e o Passo 4 tem AP = 90, a máquina rotacionará 180° físicos.
            </p>
            <p className="text-[11px]">
              <span className="text-sky-400 font-bold">Modo Relativo:</span> Cada valor de AP aplica uma rotação incremental a partir da posição atual do plano de dobra do passo anterior.
            </p>
          </div>

          <h4 className="text-slate-200 font-semibold flex items-center gap-1 pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Tradutor de Ângulo do Desenho Técnico
          </h4>
          <p className="text-slate-400">
            Geralmente, desenhos técnicos mostram o <span className="text-sky-400 font-semibold">ângulo interno/externo (abertura da peça)</span>, enquanto a máquina exige o <span className="text-slate-200 font-semibold">ângulo de dobra real</span> executado pelo pino. 
            O simulador calcula automaticamente o ângulo teórico do desenho na coluna azul <b className="text-sky-400">Desenho*</b> para facilitar seu gabarito!
          </p>
        </div>
      </div>
    </div>
  );
}
