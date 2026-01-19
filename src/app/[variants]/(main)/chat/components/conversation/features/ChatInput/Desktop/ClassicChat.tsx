'use client';

import { Alert } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Suspense, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { type ActionKeys, ChatInputProvider, DesktopChatInput } from '@/features/ChatInput';
import WideScreenContainer from '@/features/ChatList/components/WideScreenContainer';
import { useChatStore } from '@/store/chat';
import { aiChatSelectors, displayMessageSelectors } from '@/store/chat/selectors';

import { useSend } from '../useSend';
import MessageFromUrl from './MessageFromUrl';
import { useSendMenuItems } from './useSendMenuItems';

const leftActions: ActionKeys[] = [
  'model',
  'search',
  'typo',
  'fileUpload',
  'knowledgeBase',
  'tools',
  '---',
  ['params', 'history', 'stt', 'clear'],
  'mainToken',
];

const rightActions: ActionKeys[] = ['saveTopic'];

const useStyles = createStyles(({ css }) => ({
  heroWrapper: css`
    width: 100%;
    min-height: 60vh;
    justify-content: center;
  `,
  heroInner: css`
    transform: scale(1.2);
    transform-origin: center;
  `,
}));

const ClassicChatInput = memo(() => {
  const { t } = useTranslation('chat');
  const { send, generating, disabled, stop } = useSend();
  const { styles, cx } = useStyles();

  const [mainInputSendErrorMsg, clearSendMessageError] = useChatStore((s) => [
    aiChatSelectors.isCurrentSendMessageError(s),
    s.clearSendMessageError,
  ]);

  const sendMenuItems = useSendMenuItems();
  const isWelcomeMode = useChatStore(
    (s) => displayMessageSelectors.mainAIChats(s).length === 0,
  );

  return (
    <ChatInputProvider
      chatInputEditorRef={(instance) => {
        if (!instance) return;
        useChatStore.setState({ mainInputEditor: instance });
      }}
      leftActions={leftActions}
      onMarkdownContentChange={(content) => {
        useChatStore.setState({ inputMessage: content });
      }}
      onSend={() => {
        send();
      }}
      rightActions={rightActions}
      sendButtonProps={{ disabled, generating, onStop: stop }}
      sendMenu={{
        items: sendMenuItems,
      }}
    >
      <Flexbox className={cx(isWelcomeMode && styles.heroWrapper)}>
        <WideScreenContainer className={cx(isWelcomeMode && styles.heroInner)}>
          {mainInputSendErrorMsg && (
            <Flexbox paddingBlock={'0 6px'} paddingInline={12}>
              <Alert
                closable
                message={t('input.errorMsg', { errorMsg: mainInputSendErrorMsg })}
                onClose={clearSendMessageError}
                type={'warning'}
              />
            </Flexbox>
          )}
          <DesktopChatInput />
        </WideScreenContainer>
      </Flexbox>
      <Suspense>
        <MessageFromUrl />
      </Suspense>
    </ChatInputProvider>
  );
});

export default ClassicChatInput;
