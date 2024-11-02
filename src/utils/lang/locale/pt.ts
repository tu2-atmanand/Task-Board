const pt = {
  1: "Salvar",
  2: "Fechar",
  3: "Arquivo",
  4: "Quadro de tarefas aberto",
  5: "Re-Scan Vault",
  6: "Nenhum arquivo ativo encontrado para adicionar uma tarefa.",
  7: "Nenhuma tarefa disponível",
  8: "Editar tarefa",
  9: "Excluir tarefa",
  10: "Tipo de coluna",
  11: "Sem data",
  12: "Datado",
  13: "Marcado",
  14: "Não marcado",
  15: "Concluído",
  16: "Outras tags",
  17: "Nome da coluna",
  18: "Enviar",
  19: "Cancelar",
  20: "Insira o nome da coluna",
  21: "Editar tarefa",
  22: "Adicionar nova tarefa",
  23: "Título da tarefa",
  24: "Subtarefas",
  25: "Pré-visualização",
  26: "Editor",
  27: "Abrir arquivo",
  28: "Edite ou adicione uma descrição para a tarefa ou adicione mais subtarefas.",
  29: "Conteúdo do corpo",
  30: "Hora de Início da Tarefa",
  31: "Hora de término da tarefa",
  32: "Data de Vencimento da Tarefa",
  33: "Prioridade da tarefa",
  34: "Etiqueta de tarefa",
  35: "Nenhuma placa selecionada para exclusão.",
  36: "Configurações globais do plugin",
  37: "Configurações",
  38: "Nome do Conselho",
  39: "Nome do quadro que aparecerá como uma aba no cabeçalho da aba dentro do plugin.",
  40: "Mostrar tags para colunas do tipo namedTag",
  41: "Só funciona para colunas do tipo namedTag. Se você não quiser ver a tag no cartão para o tipo de coluna.",
  42: "Etiquetas de filtro",
  43: "Insira as tags, separadas por vírgula, que você quer ver neste quadro. Somente tarefas com essas tags serão mostradas.",
  44: "Polaridade do filtro",
  45: "Ative ou desative as tags de filtro acima dentro dos quadros.",
  46: "Ativar",
  47: "Desativar",
  48: "Mostrar tags filtradas",
  49: "Se as tags filtradas mencionadas acima devem ser mostradas no Cartão de Item de Tarefa.",
  50: "Colunas",
  51: "Insira a etiqueta",
  52: "Itens máximos",
  53: "De",
  54: "Para",
  55: "Excluir coluna",
  56: "Adicionar coluna",
  57: "Excluir este quadro",
  58: "Configurações globais",
  59: "Adicionar quadro",
  60: "Confirmar Excluir",
  61: "Tem certeza de que deseja excluir esta tarefa?",
  62: "Sim",
  63: "Não",
  64: "Digitalização do cofre concluída.",
  65: "Tarefas de digitalização do Vault",
  66: "Execute este recurso somente se suas tarefas não tiverem sido detectadas/verificadas corretamente ou se o quadro estiver agindo de forma estranha.",
  67: "Você não precisa executar esse recurso com frequência, o plugin detectará automaticamente tarefas recém-adicionadas/editadas.",
  68: "OBSERVAÇÃO: verifique primeiro os Filtros de Verificação de Arquivos nas configurações do plugin, se estiver executando esta função para verificar tarefas não detectadas.",
  69: "Correr",
  70: "Ocultar tarefas coletadas",
  71: "Mostrar tarefas coletadas",
  72: "Falha ao carregar as configurações.",
  73: "Leia a documentação para fazer um uso eficiente do plugin:",
  74: "Documentação do quadro de tarefas",
  75: "Filtros para digitalização",
  76: "Somente escaneie isto",
  77: "Não escaneie isso",
  78: "Desabilitar",
  79: "Configurações da interface do usuário do quadro",
  80: "Mostrar cabeçalho do cartão de item de tarefa",
  81: "Habilite isso para ver o cabeçalho no cartão de item de tarefa",
  82: "Mostrar rodapé do cartão de item de tarefa",
  83: "Habilite isso para ver o rodapé no cartão de item de tarefa",
  84: "Largura de cada coluna",
  85: "Insira o valor de largura para cada coluna. O valor padrão é 273px",
  86: "Mostrar barra de rolagem da coluna",
  87: "Habilite para ver uma barra de rolagem para cada coluna. Isso reduzirá a largura dos Cartões de Tarefas.",
  88: "Cores das tags",
  89: "Excluir",
  90: "Adicionar cor de etiqueta",
  91: "Nome da etiqueta",
  92: "Configurações de automação",
  93: "Escaneamento em tempo real",
  94: "Depois de perder o foco do arquivo editado, a tarefa será imediatamente atualizada no Painel de Tarefas.\nDesabilitar esta configuração fará a varredura dos arquivos modificados após algum tempo.",
  95: "Adicionar data de vencimento automaticamente às tarefas",
  96: "Quando ativado, se você adicionar uma tarefa usando a janela pop-up Adicionar nova tarefa, a data de hoje será adicionada como Data de vencimento, se o valor não for inserido.",
  97: "Auto Scan do Vault na inicialização do Obsidian",
  98: "Use este recurso somente se você editar os arquivos do vault fora do Obsidian. Normalmente, todas as suas tarefas recém-adicionadas/editadas serão detectadas automaticamente.",
  99: "Se o seu cofre contiver muitos arquivos com dados enormes, isso pode afetar o tempo de inicialização do Obsidian.",
  100: "Configurações de compatibilidade",
  101: "compatibilidade de plugins",
  102: "Se você instalou o Day Planner Plugin, este plugin insere o horário no início do corpo da tarefa, em vez dos metadados. Após habilitar este recurso, o horário será exibido de acordo com o plugin Day Planner dentro dos arquivos Markdown, mas no Task Board, o horário será exibido no Task Footer.",
  103: "Quando habilitado, se você adicionar uma tarefa em um arquivo Daily Note, que tem um nome de arquivo como 'aaaa-MM-DD'. Então essa data será considerada como a Data de Vencimento para a tarefa.",
  104: "Formato de data de vencimento",
  105: "Insira o formato da Data que você está usando para nomear seus arquivos de Notas Diárias. Use 'aaaa-MM-DD' ou 'DD-MM-aaaa'",
  106: "Formatos de data de vencimento e conclusão",
  107: "A pré-visualização aparecerá aqui",
  108: "Plugin compatível",
  109: "Diferentes plugins têm formatos diferentes para dar as tags Due e Completion na tarefa. Selecione um e veja o formato acima, se for compatível com sua configuração atual.",
  110: "Padrão",
  111: "Padrão de data e hora de conclusão da tarefa",
  112: "Insira o padrão de Data-Hora que você gostaria de ver para o valor de Conclusão. Por exemplo, aaaa-MM-ddTHH:mm:ss",
  113: "Primeiro dia da semana",
  114: "Defina o primeiro dia da semana",
  115: "Domingo",
  116: "Segunda-feira",
  117: "Terça-feira",
  118: "Quarta-feira",
  119: "Quinta-feira",
  120: "Sexta-feira",
  121: "Sábado",
  122: "Conclusão da tarefa no horário local",
  123: "Se os tempos de conclusão das tarefas são exibidos no horário local",
  124: "Mostrar deslocamento UTC para conclusão de tarefa",
  125: "Se deve exibir o deslocamento UTC para os tempos de conclusão das tarefas",
  126: "Se você gosta deste plugin, considere apoiar meu trabalho fazendo uma pequena doação para melhorar continuamente a ideia!",
  127: "Idioma do plugin",
  128: "Selecione o idioma da UI do Plugin. Para contribuir para melhorar o idioma atual ou adicionar seu próprio idioma nativo, consulte os documentos.",
  129: "Tem certeza de que deseja excluir este quadro?\nVocê pode criá-lo novamente facilmente se lembrar da configuração.",
  130: "Quadro de tarefas",
  131: "Adicionar nova tarefa no arquivo atual",
  132: "Quadro de tarefas aberto",
  133: "Abrir quadro de tarefas em nova janela",
  134: "Atualizar tarefas deste arquivo",
  135: "Adicionar arquivo no filtro `Não escanear este arquivo`",
  136: "Adicionar arquivo no filtro `Verificar somente este arquivo`",
  137: "Adicionar pasta no filtro `Não escanear esta pasta`",
  138: "Adicionar pasta no filtro `Verificar somente esta pasta`",
  139: "Filtros de placa",
  140: "Arquivos",
  141: "Pastas",
  142: "Etiquetas",
  143: "Plug-in",
  144: "Nativo",
  145: "Botão Configurar Placa",
  146: "Botão Atualizar Quadro",
  147: "Nenhum Editor ativo está aberto. Coloque seu cursor dentro do Editor e execute este comando.",
};
export default pt;