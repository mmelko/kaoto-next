import {
  FunctionComponent,
  PropsWithChildren,
  createContext,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { EventNotifier } from '../utils';

interface ISourceCodeApi {
  /** Set the Source Code and notify subscribers */
  setCodeAndNotify: (sourceCode: string) => void;
  switchFormat: (format: 'xml' | 'yaml') => void;
}

export const SourceCodeContext = createContext<string>('');
export const SourceCodeApiContext = createContext<ISourceCodeApi>({
  setCodeAndNotify: () => {},
  switchFormat: () => {},
});

export const SourceCodeProvider: FunctionComponent<PropsWithChildren> = (props) => {
  const eventNotifier = EventNotifier.getInstance();
  const [sourceCode, setSourceCode] = useState<string>('');

  useLayoutEffect(() => {
    return eventNotifier.subscribe('entities:updated', (code) => {
      setSourceCode(code);
    });
  }, [eventNotifier]);

  const setCodeAndNotify = useCallback(
    (code: string) => {
      setSourceCode(code);
      eventNotifier.next('code:updated', code);
    },
    [eventNotifier],
  );

  const switchFormat = useCallback(
    (format: 'xml' | 'yaml') => {
      eventNotifier.next('format:switched', format);
    },
    [eventNotifier],
  );

  const sourceCodeApi: ISourceCodeApi = useMemo(
    () => ({
      setCodeAndNotify,
      switchFormat,
    }),
    [setCodeAndNotify, switchFormat],
  );

  return (
    <SourceCodeApiContext.Provider value={sourceCodeApi}>
      <SourceCodeContext.Provider value={sourceCode}>{props.children}</SourceCodeContext.Provider>
    </SourceCodeApiContext.Provider>
  );
};
