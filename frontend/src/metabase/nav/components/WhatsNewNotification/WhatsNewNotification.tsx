import { useCallback, useMemo } from "react";
import { t } from "ttag";

import { updateSetting } from "metabase/admin/settings/settings";
import { useGetVersionInfoQuery } from "metabase/api";
import { useSetting } from "metabase/common/hooks";
import { color } from "metabase/lib/colors";
import { useDispatch, useSelector } from "metabase/lib/redux";
import { getIsEmbeddingIframe } from "metabase/selectors/embed";
import { getIsWhiteLabeling } from "metabase/selectors/whitelabel";
import { Anchor, Flex, Icon, Paper, Stack, Text } from "metabase/ui";

import { DismissIconButtonWrapper } from "./WhatsNewNotification.styled";
import Sparkles from "./sparkles.svg?component";
import { getLatestEligibleReleaseNotes } from "./utils";

export function WhatsNewNotification() {
  const dispatch = useDispatch();
  const isEmbeddingIframe = useSelector(getIsEmbeddingIframe);
  const { data: versionInfo } = useGetVersionInfoQuery();
  const currentVersion = useSetting("version");
  const lastAcknowledgedVersion = useSetting("last-acknowledged-version");
  const isWhiteLabeling = useSelector(getIsWhiteLabeling);

  const url: string | undefined = useMemo(() => {
    const lastEligibleVersion = getLatestEligibleReleaseNotes({
      versionInfo,
      currentVersion: currentVersion.tag,
      lastAcknowledgedVersion: lastAcknowledgedVersion,
      isEmbeddingIframe,
      isWhiteLabeling,
    });

    return lastEligibleVersion?.announcement_url;
  }, [
    versionInfo,
    currentVersion.tag,
    lastAcknowledgedVersion,
    isEmbeddingIframe,
    isWhiteLabeling,
  ]);

  const dimiss = useCallback(() => {
    dispatch(
      updateSetting({
        key: "last-acknowledged-version",
        value: currentVersion.tag,
      }),
    );
  }, [currentVersion.tag, dispatch]);

  if (!url) {
    return null;
  }
  return (
    <Paper my="lg" mx="auto" p="md" shadow="md" withBorder w={244}>
      <Stack gap="sm">
        <Flex justify="space-between">
          <Sparkles color={color("brand")} />
          <DismissIconButtonWrapper onClick={dimiss}>
            <Icon name="close" />
          </DismissIconButtonWrapper>
        </Flex>

        {/* eslint-disable-next-line no-literal-metabase-strings -- This only shows for admins */}
        <Text fw="bold" size="sm">{t`Metabase has been updated`}</Text>

        <Anchor
          size="sm"
          fw="bold"
          component="a"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          {t`See what's new`}
        </Anchor>
      </Stack>
    </Paper>
  );
}
