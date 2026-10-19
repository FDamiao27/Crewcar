// Modelos iniciais das páginas legais. São criados como RASCUNHO (não publicados) e contêm
// campos entre [parênteses retos] que têm de ser preenchidos pela empresa e revistos por um
// profissional antes da publicação. Não afirmam qualquer conformidade jurídica verificada.

export const LEGAL_TEMPLATES: { slug: string; title: string; body: string }[] = [
  {
    slug: "privacidade",
    title: "Política de privacidade",
    body: `## Responsável pelo tratamento

[Denominação social], com o NIF [número] e sede em [morada], é a entidade responsável pelo tratamento dos dados pessoais recolhidos através deste website.

Contacto para questões de privacidade: [e-mail].

## Dados que recolhemos

Quando utiliza o formulário de contacto, recolhemos os dados que nos fornece: nome, endereço de e-mail, número de telefone, a viatura em que tem interesse e o conteúdo da mensagem.

## Finalidades e fundamento

Utilizamos estes dados para responder ao seu pedido e, quando solicitado, para preparar uma proposta relativa a uma viatura. [Indicar o fundamento de licitude aplicável, por exemplo: diligências pré-contratuais a pedido do titular ou consentimento.]

## Conservação

Os dados são conservados durante [prazo] após o último contacto, sendo depois eliminados, salvo obrigação legal de conservação.

## Partilha de dados

[Indicar as categorias de subcontratantes — por exemplo, alojamento do website e da base de dados — e a localização dos servidores.]

## Os seus direitos

Pode, a qualquer momento, solicitar o acesso, a retificação, o apagamento, a limitação do tratamento, a portabilidade dos seus dados ou opor-se ao tratamento, através do contacto indicado acima. Tem também o direito de apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD).

## Atualizações

Última atualização: [data].`,
  },
  {
    slug: "cookies",
    title: "Política de cookies",
    body: `## O que são cookies

Cookies são pequenos ficheiros de texto guardados no seu dispositivo quando visita um website.

## Cookies que utilizamos

**Essenciais (sempre ativos)**

- *cc_consent* — guarda a sua escolha relativamente a cookies (180 dias).

**Análise (apenas com o seu consentimento)**

- [Indicar a ferramenta de análise utilizada, os cookies que define e a respetiva duração — ou remover esta secção se não for utilizada nenhuma.]

## Gerir as suas preferências

Pode alterar a sua escolha a qualquer momento através da ligação "Preferências de cookies", no rodapé do website, ou eliminando os cookies nas definições do seu navegador.

Última atualização: [data].`,
  },
  {
    slug: "informacao-legal",
    title: "Informação legal",
    body: `## Identificação da empresa

- Denominação social: [denominação]
- NIF: [número]
- Sede: [morada]
- Registo / licença de atividade: [se aplicável]

## Preços e informação das viaturas

Os preços apresentados incluem [indicar se incluem IVA, despesas de legalização e outros encargos]. As características das viaturas são as indicadas pelo stand e podem ser confirmadas presencialmente.

Quando é anunciada uma redução de preço, o preço anterior indicado corresponde ao preço mais baixo praticado nos 30 dias anteriores à redução.

## Livro de Reclamações

Dispomos de Livro de Reclamações em formato físico e eletrónico, disponível em www.livroreclamacoes.pt.

## Resolução alternativa de litígios

Em caso de litígio, o consumidor pode recorrer a uma entidade de resolução alternativa de litígios de consumo: [indicar a entidade competente e o respetivo website]. Mais informações no Portal do Consumidor (www.consumidor.gov.pt).`,
  },
];
