import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  Play, MessageSquare, List, FormInput, GitBranch, 
  Zap, ArrowRightLeft, Sparkles, Square, Trash2, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface FlowNodeData {
  label: string;
  content?: Record<string, unknown>;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const nodeColors: Record<string, { bg: string; border: string; icon: string }> = {
  start: { bg: 'bg-green-500/10', border: 'border-green-500', icon: 'text-green-500' },
  message: { bg: 'bg-blue-500/10', border: 'border-blue-500', icon: 'text-blue-500' },
  menu: { bg: 'bg-purple-500/10', border: 'border-purple-500', icon: 'text-purple-500' },
  input: { bg: 'bg-amber-500/10', border: 'border-amber-500', icon: 'text-amber-500' },
  condition: { bg: 'bg-orange-500/10', border: 'border-orange-500', icon: 'text-orange-500' },
  action: { bg: 'bg-cyan-500/10', border: 'border-cyan-500', icon: 'text-cyan-500' },
  transfer: { bg: 'bg-pink-500/10', border: 'border-pink-500', icon: 'text-pink-500' },
  ai_response: { bg: 'bg-violet-500/10', border: 'border-violet-500', icon: 'text-violet-500' },
  end: { bg: 'bg-red-500/10', border: 'border-red-500', icon: 'text-red-500' },
};

const nodeIcons: Record<string, React.ElementType> = {
  start: Play,
  message: MessageSquare,
  menu: List,
  input: FormInput,
  condition: GitBranch,
  action: Zap,
  transfer: ArrowRightLeft,
  ai_response: Sparkles,
  end: Square,
};

interface BaseNodeProps extends NodeProps<FlowNodeData> {
  nodeType: string;
}

function BaseFlowNode({ id, data, nodeType, selected }: BaseNodeProps) {
  const colors = nodeColors[nodeType] || nodeColors.message;
  const Icon = nodeIcons[nodeType] || MessageSquare;
  const isStart = nodeType === 'start';
  const isEnd = nodeType === 'end';

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-xl border-2 shadow-lg min-w-[180px] max-w-[250px] transition-all',
        colors.bg,
        colors.border,
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
    >
      {/* Input Handle */}
      {!isStart && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('p-1.5 rounded-lg', colors.bg)}>
          <Icon className={cn('h-4 w-4', colors.icon)} />
        </div>
        <span className="font-medium text-sm truncate flex-1">{data.label}</span>
        {!isStart && !isEnd && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                data.onEdit?.(id);
              }}
            >
              <Settings className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                data.onDelete?.(id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Content Preview */}
      {data.content && (
        <div className="text-xs text-muted-foreground line-clamp-2">
          {nodeType === 'message' && (data.content.text as string)}
          {nodeType === 'menu' && `${((data.content.options as any[]) || []).length} opções`}
          {nodeType === 'input' && `Variável: ${data.content.variable}`}
          {nodeType === 'condition' && `${data.content.variable} ${data.content.operator} ${data.content.value}`}
          {nodeType === 'action' && `Ação: ${data.content.type}`}
          {nodeType === 'transfer' && 'Transferir para atendente'}
          {nodeType === 'ai_response' && 'Resposta da IA'}
        </div>
      )}

      {/* Output Handle(s) */}
      {!isEnd && (
        <>
          {nodeType === 'condition' ? (
            <>
              <Handle
                type="source"
                position={Position.Bottom}
                id="true"
                className="!w-3 !h-3 !bg-green-500 !border-2 !border-background !left-[30%]"
              />
              <Handle
                type="source"
                position={Position.Bottom}
                id="false"
                className="!w-3 !h-3 !bg-red-500 !border-2 !border-background !left-[70%]"
              />
            </>
          ) : nodeType === 'menu' ? (
            // Menu nodes have multiple outputs based on options
            <Handle
              type="source"
              position={Position.Bottom}
              className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
            />
          ) : (
            <Handle
              type="source"
              position={Position.Bottom}
              className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
            />
          )}
        </>
      )}
    </div>
  );
}

// Export individual node types
export const StartNode = memo((props: NodeProps<FlowNodeData>) => (
  <BaseFlowNode {...props} nodeType="start" />
));
StartNode.displayName = 'StartNode';

export const MessageNode = memo((props: NodeProps<FlowNodeData>) => (
  <div className="group">
    <BaseFlowNode {...props} nodeType="message" />
  </div>
));
MessageNode.displayName = 'MessageNode';

export const MenuNode = memo((props: NodeProps<FlowNodeData>) => (
  <div className="group">
    <BaseFlowNode {...props} nodeType="menu" />
  </div>
));
MenuNode.displayName = 'MenuNode';

export const InputNode = memo((props: NodeProps<FlowNodeData>) => (
  <div className="group">
    <BaseFlowNode {...props} nodeType="input" />
  </div>
));
InputNode.displayName = 'InputNode';

export const ConditionNode = memo((props: NodeProps<FlowNodeData>) => (
  <div className="group">
    <BaseFlowNode {...props} nodeType="condition" />
  </div>
));
ConditionNode.displayName = 'ConditionNode';

export const ActionNode = memo((props: NodeProps<FlowNodeData>) => (
  <div className="group">
    <BaseFlowNode {...props} nodeType="action" />
  </div>
));
ActionNode.displayName = 'ActionNode';

export const TransferNode = memo((props: NodeProps<FlowNodeData>) => (
  <div className="group">
    <BaseFlowNode {...props} nodeType="transfer" />
  </div>
));
TransferNode.displayName = 'TransferNode';

export const AIResponseNode = memo((props: NodeProps<FlowNodeData>) => (
  <div className="group">
    <BaseFlowNode {...props} nodeType="ai_response" />
  </div>
));
AIResponseNode.displayName = 'AIResponseNode';

export const EndNode = memo((props: NodeProps<FlowNodeData>) => (
  <BaseFlowNode {...props} nodeType="end" />
));
EndNode.displayName = 'EndNode';

export const nodeTypes = {
  start: StartNode,
  message: MessageNode,
  menu: MenuNode,
  input: InputNode,
  condition: ConditionNode,
  action: ActionNode,
  transfer: TransferNode,
  ai_response: AIResponseNode,
  end: EndNode,
};
