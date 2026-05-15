export type LinhaRanking = {
  nome: string;
  operador?: string;
  horasTotais: number;
  horasFalha: number;
  horasIndisponibilidade: number;
  horasDegradacao: number;
  horasProgramadaEspecial: number;
  qtdRegistros: number;
  qtdFalhas: number;
  qtdIndisponibilidade: number;
  uptimePct: number;
};

export type ProblemaRecorrente = {
  categoria: string;
  qtd: number;
  horas: number;
};
