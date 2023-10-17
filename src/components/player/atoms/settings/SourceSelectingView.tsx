import classNames from "classnames";
import { ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { useAsyncFn } from "react-use";

import { Icon, Icons } from "@/components/Icon";
import { usePlayerMeta } from "@/components/player/hooks/usePlayerMeta";
import { Context } from "@/components/player/internals/ContextUtils";
import { convertRunoutputToSource } from "@/components/player/utils/convertRunoutputToSource";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { metaToScrapeMedia } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";
import { providers } from "@/utils/providers";

export interface SourceSelectionViewProps {
  id: string;
  onChoose?: (id: string) => void;
}

export interface EmbedSelectionViewProps {
  id: string;
  sourceId: string | null;
}

export function SourceOption(props: {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={props.onClick}
      className="grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded -ml-3 -mr-3 px-3 py-2 cursor-pointer hover:bg-video-context-border hover:bg-opacity-10"
    >
      <span
        className={classNames(props.selected && "text-white", "font-medium")}
      >
        {props.children}
      </span>
      {props.selected ? (
        <Icon
          icon={Icons.CIRCLE_CHECK}
          className="text-xl text-video-context-type-accent"
        />
      ) : null}
    </div>
  );
}

export function EmbedOption(props: {
  embedId: string;
  url: string;
  routerId: string;
}) {
  const router = useOverlayRouter(props.routerId);
  const meta = usePlayerStore((s) => s.meta);
  const setSource = usePlayerStore((s) => s.setSource);
  const progress = usePlayerStore((s) => s.progress.time);
  const embedName = useMemo(() => {
    if (!props.embedId) return "...";
    const sourceMeta = providers.getMetadata(props.embedId);
    return sourceMeta?.name ?? "...";
  }, [props.embedId]);
  const [request, run] = useAsyncFn(async () => {
    const result = await providers.runEmbedScraper({
      id: props.embedId,
      url: props.url,
    });
    setSource(convertRunoutputToSource({ stream: result.stream }), progress);
    router.close();
  }, [props.embedId, meta, router]);

  let content: ReactNode = null;
  if (request.loading) content = <span>loading...</span>;
  else if (request.error) content = <span>Failed to scrape</span>;

  return (
    <SourceOption onClick={run}>
      <span className="flex flex-col">
        <span>{embedName}</span>
        {content}
      </span>
    </SourceOption>
  );
}

export function EmbedSelectionView({ sourceId, id }: EmbedSelectionViewProps) {
  const router = useOverlayRouter(id);
  const meta = usePlayerStore((s) => s.meta);
  const setSource = usePlayerStore((s) => s.setSource);
  const progress = usePlayerStore((s) => s.progress.time);
  const sourceName = useMemo(() => {
    if (!sourceId) return "...";
    const sourceMeta = providers.getMetadata(sourceId);
    return sourceMeta?.name ?? "...";
  }, [sourceId]);
  const [request, run] = useAsyncFn(async () => {
    if (!sourceId || !meta) return null;
    const scrapeMedia = metaToScrapeMedia(meta);
    const result = await providers.runSourceScraper({
      id: sourceId,
      media: scrapeMedia,
    });
    if (result.stream) {
      setSource(convertRunoutputToSource({ stream: result.stream }), progress);
      router.close();
      return null;
    }
    return result.embeds;
  }, [sourceId, meta, router]);

  const lastSourceId = useRef<string | null>(null);
  useEffect(() => {
    if (lastSourceId.current === sourceId) return;
    lastSourceId.current = sourceId;
    if (!sourceId) return;
    run();
  }, [run, sourceId]);

  let content: ReactNode = null;
  if (request.loading) content = <p>loading...</p>;
  else if (request.error) content = <p>Failed to scrape</p>;
  else if (request.value && request.value.length === 0)
    content = <p>No embeds found</p>;
  else if (request.value)
    content = request.value.map((v) => (
      <EmbedOption
        key={v.embedId}
        embedId={v.embedId}
        url={v.url}
        routerId={id}
      />
    ));

  return (
    <>
      <Context.BackLink onClick={() => router.navigate("/source")}>
        {sourceName}
      </Context.BackLink>
      <Context.Section>{content}</Context.Section>
    </>
  );
}

export function SourceSelectionView({
  id,
  onChoose,
}: SourceSelectionViewProps) {
  const router = useOverlayRouter(id);
  const metaType = usePlayerStore((s) => s.meta?.type);
  const sources = useMemo(() => {
    if (!metaType) return [];
    return providers
      .listSources()
      .filter((v) => v.mediaTypes?.includes(metaType));
  }, [metaType]);

  return (
    <>
      <Context.BackLink onClick={() => router.navigate("/")}>
        Sources
      </Context.BackLink>
      <Context.Section>
        {sources.map((v) => (
          <SourceOption
            key={v.id}
            onClick={() => {
              onChoose?.(v.id);
              router.navigate("/source/embeds");
            }}
          >
            {v.name}
          </SourceOption>
        ))}
      </Context.Section>
    </>
  );
}
