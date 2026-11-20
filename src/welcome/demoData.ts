import { FlowSpec, TableSpec, CompareSpec, QuizSpec, StepperSpec, ChartSpec, MermaidSpec, UISpec } from '../core/types';

export interface DemoItem {
  id: string;
  name: string;
  question: string;
  spec: UISpec;
}

export const DEMO_ITEMS: DemoItem[] = [
  {
    id: 'flow',
    name: 'Flow diagram',
    question: 'Design a URL shortener like bit.ly. Show the high-level architecture.',
    spec: {
      type: 'flow',
      title: 'URL Shortener Architecture',
      nodes: [
        { id: 'client', label: 'Client / App', sub: 'HTTP Request', icon: 'monitor', color: 'blue' },
        { id: 'gateway', label: 'API Gateway', sub: 'Rate Limiter', icon: 'server', color: 'teal' },
        { id: 'cache', label: 'Redis Cache', sub: 'In-Memory KV', icon: 'zap', color: 'amber' },
        { id: 'db', label: 'Primary DB', sub: 'Postgres Cluster', icon: 'database', color: 'purple' },
      ],
      edges: [
        { from: 'client', to: 'gateway', label: 'POST /shorten' },
        { from: 'gateway', to: 'cache', label: 'Check alias' },
        { from: 'cache', to: 'db', label: 'Cache miss' },
      ],
    } as FlowSpec,
  },
  {
    id: 'table',
    name: 'Capacity table',
    question: 'Show the capacity estimation table for 100M daily writes.',
    spec: {
      type: 'table',
      title: 'Database Storage & Bandwidth Estimates',
      columns: ['Metric', 'Per Second', 'Monthly', '5 Years'],
      rows: [
        ['New Shortened URLs', '1.16k req/s', '3 Billion', '180 Billion'],
        ['Redirect Reads', '23.1k req/s', '60 Billion', '3.6 Trillion'],
        ['Storage Needed', '580 KB/s', '1.5 TB', '90 TB'],
        ['Cache Memory (80/20)', '116 MB/s', '300 GB', '18 TB'],
      ],
    } as TableSpec,
  },
  {
    id: 'compare',
    name: 'Comparison',
    question: 'Compare SQL vs NoSQL database options for this service.',
    spec: {
      type: 'compare',
      title: 'Storage Choice: SQL vs NoSQL',
      items: [
        {
          label: 'Relational (PostgreSQL)',
          tone: 'neutral',
          points: [
            'Strict ACID guarantees on alias uniqueness',
            'Mature B-tree indexes for fast lookups',
            'Requires manual sharding at 100B+ rows',
          ],
        },
        {
          label: 'NoSQL (DynamoDB / Cassandra)',
          tone: 'good',
          points: [
            'Sub-10ms predictable read latency globally',
            'Effortless horizontal auto-scaling',
            'Simple key-value access pattern fits cleanly',
          ],
        },
      ],
    } as CompareSpec,
  },
  {
    id: 'quiz',
    name: 'Knowledge quiz',
    question: 'Create a 1-question quiz on URL shortening algorithms.',
    spec: {
      type: 'quiz',
      title: 'System Design Checkpoint',
      questions: [
        {
          q: 'Why is Base62 encoding preferred over Base64 for shortened URLs?',
          options: [
            'Base62 produces shorter strings than Base64',
            'Base62 avoids URL-unsafe characters like + and /',
            'Base62 automatically compresses the hash output',
            'Base62 is natively indexed by relational DBs',
          ],
          answer: 1,
          explain: 'Base62 uses only [0-9, a-z, A-Z], avoiding characters like +, /, and = which require URL percent-encoding.',
        },
      ],
    } as QuizSpec,
  },
];

export type PastelName = 'sky' | 'mint' | 'butter' | 'peach' | 'rose' | 'lavender' | 'stone';

export interface FeatureCardItem {
  type: string;
  title: string;
  copy: string;
  pastel: PastelName;
  icon: string;
  spec: UISpec;
}

export const FEATURE_CARDS: FeatureCardItem[] = [
  {
    type: 'flow',
    title: 'Flow diagrams',
    copy: 'Visualize architectures, pipelines, and distributed system flows.',
    pastel: 'sky',
    icon: 'workflow',
    spec: {
      type: 'flow',
      title: 'Request Flow',
      nodes: [
        { id: 'a', label: 'Client', icon: 'monitor', color: 'blue' },
        { id: 'b', label: 'Gateway', icon: 'server', color: 'teal' },
      ],
      edges: [{ from: 'a', to: 'b', label: 'GET /status' }],
    } as FlowSpec,
  },
  {
    type: 'stepper',
    title: 'Step-by-step guides',
    copy: 'Follow clear ordered instructions, setup guides, and walkthroughs.',
    pastel: 'mint',
    icon: 'list',
    spec: {
      type: 'stepper',
      title: 'Deployment Steps',
      steps: [
        { title: 'Provision Infra', detail: 'Initialize Terraform state and VPCs.' },
        { title: 'Deploy App', detail: 'Roll out containers across availability zones.' },
      ],
    } as StepperSpec,
  },
  {
    type: 'table',
    title: 'Tables',
    copy: 'Explore dense structured data, benchmarks, and comparison matrices.',
    pastel: 'stone',
    icon: 'table',
    spec: {
      type: 'table',
      title: 'Benchmark Results',
      columns: ['Platform', 'Latency', 'Throughput'],
      rows: [
        ['Gemini 1.5', '320ms', '140 tps'],
        ['Grok 2.0', '290ms', '165 tps'],
      ],
    } as TableSpec,
  },
  {
    type: 'compare',
    title: 'Comparisons',
    copy: 'Weigh pros, cons, tradeoffs, and side-by-side alternatives.',
    pastel: 'peach',
    icon: 'scale',
    spec: {
      type: 'compare',
      title: 'Architecture Tradeoffs',
      items: [
        { label: 'Monolith', tone: 'neutral', points: ['Simpler deployment', 'Single point of failure'] },
        { label: 'Microservices', tone: 'good', points: ['Independent scaling', 'Higher operational complexity'] },
      ],
    } as CompareSpec,
  },
  {
    type: 'chart',
    title: 'Charts',
    copy: 'Render interactive bar, line, pie, and doughnut charts instantly.',
    pastel: 'butter',
    icon: 'bar-chart-3',
    spec: {
      type: 'chart',
      title: 'Latency by Region (ms)',
      chartType: 'bar',
      labels: ['US', 'EU', 'AP'],
      datasets: [{ label: 'p99 Latency', data: [45, 62, 88] }],
      unit: 'ms',
    } as ChartSpec,
  },
  {
    type: 'mermaid',
    title: 'Mermaid diagrams',
    copy: 'Turn raw Mermaid sequence, class, and entity diagrams into graphics.',
    pastel: 'lavender',
    icon: 'code',
    spec: {
      type: 'mermaid',
      title: 'Service Handshake',
      code: 'sequenceDiagram\nClient->>Server: SYN\nServer-->>Client: SYN-ACK\nClient->>Server: ACK',
    } as MermaidSpec,
  },
  {
    type: 'quiz',
    title: 'Quizzes',
    copy: 'Test your knowledge with interactive multiple-choice questions.',
    pastel: 'rose',
    icon: 'sparkles',
    spec: {
      type: 'quiz',
      title: 'Quick Check',
      questions: [
        {
          q: 'What is the default port for HTTPS?',
          options: ['80', '443', '8080'],
          answer: 1,
          explain: 'HTTPS communicates over TCP port 443 by default.',
        },
      ],
    } as QuizSpec,
  },
];
