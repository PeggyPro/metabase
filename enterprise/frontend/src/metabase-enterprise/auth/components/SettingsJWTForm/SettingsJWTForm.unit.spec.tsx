import userEvent from "@testing-library/user-event";
import fetchMock from "fetch-mock";

import { renderWithProviders, screen, waitFor, within } from "__support__/ui";
import { createMockGroup } from "metabase-types/api/mocks";

import { SettingsJWTForm } from "./SettingsJWTForm";

const GROUPS = [
  createMockGroup(),
  createMockGroup({ id: 2, name: "Administrators" }),
  createMockGroup({ id: 3, name: "foo" }),
  createMockGroup({ id: 4, name: "bar" }),
  createMockGroup({ id: 5, name: "flamingos" }),
];

const elements = [
  {
    key: "jwt-enabled",
    value: null,
    is_env_setting: false,
    env_name: "MB_JWT_ENABLED",
    description: "Is JWT authentication configured and enabled?",
    originalValue: null,
    display_name: "JWT Authentication",
    type: "boolean" as const,
  },
  {
    key: "jwt-user-provisioning-enabled?",
    value: null,
    is_env_setting: false,
    env_name: "MB_JWT_USER_PROVISIONING_ENABLED",
    display_name: "User Provisioning",
    description:
      "When we enable JWT user provisioning, we automatically create a Metabase account on LDAP signin for users who\ndon't have one.",
    default: true,
  },
  {
    placeholder: "https://jwt.yourdomain.org",
    key: "jwt-identity-provider-uri",
    value: null,
    is_env_setting: false,
    env_name: "MB_JWT_IDENTITY_PROVIDER_URI",
    description:
      "URL for JWT-based login page. Optional if using JWT SSO only with the embedded analytics SDK.",
    originalValue: null,
    display_name: "JWT Identity Provider URI",
    type: "string" as const,
    required: true,
    autoFocus: true,
  },
  {
    key: "jwt-shared-secret",
    value: null,
    is_env_setting: false,
    env_name: "MB_JWT_SHARED_SECRET",
    description:
      "String used to seed the private key used to validate JWT messages. A hexadecimal-encoded 256-bit key (i.e., a 64-character string) is strongly recommended.",
    originalValue: null,
    display_name: "String used by the JWT signing key",
    type: "text" as const,
    required: true,
  },
  {
    placeholder: "email",
    key: "jwt-attribute-email",
    value: null,
    is_env_setting: false,
    env_name: "MB_JWT_ATTRIBUTE_EMAIL",
    description: "Key to retrieve the JWT users email address",
    default: "email",
    originalValue: null,
    display_name: "Email attribute",
    type: "string" as const,
  },
  {
    placeholder: "first_name",
    key: "jwt-attribute-firstname",
    value: null,
    is_env_setting: false,
    env_name: "MB_JWT_ATTRIBUTE_FIRSTNAME",
    description: "Key to retrieve the JWT users first name",
    default: "first_name",
    originalValue: null,
    display_name: "First name attribute",
    type: "string" as const,
  },
  {
    placeholder: "last_name",
    key: "jwt-attribute-lastname",
    value: null,
    is_env_setting: false,
    env_name: "MB_JWT_ATTRIBUTE_LASTNAME",
    description: "Key to retrieve the JWT users last name",
    default: "last_name",
    originalValue: null,
    display_name: "Last name attribute",
    type: "string" as const,
  },
  {
    key: "jwt-group-sync",
    value: null,
    is_env_setting: false,
    env_name: "MB_JWT_GROUP_SYNC",
    originalValue: null,
    display_name: "Synchronize group memberships",
  },
  {
    key: "jwt-group-mappings",
    value: null,
    is_env_setting: false,
    env_name: "MB_JWT_GROUP_MAPPINGS",
    description: "JSON containing JWT to Metabase group mappings.",
    originalValue: null,
  },
];

const settingValues = {
  "jwt-enabled": true,
};

const setup = () => {
  const onSubmit = jest.fn();

  fetchMock.get("path:/api/permissions/group", GROUPS);

  renderWithProviders(
    <SettingsJWTForm
      elements={elements}
      settingValues={settingValues}
      onSubmit={onSubmit}
    />,
    {},
  );

  return {
    onSubmit,
  };
};

describe("SettingsJWTForm", () => {
  it("should submit the correct payload", async () => {
    const { onSubmit } = setup();

    const ATTRS = {
      "jwt-user-provisioning-enabled?": false,
      "jwt-identity-provider-uri": "http://example.com",
      "jwt-shared-secret":
        "590ab155f412d477b8ab9c8b0e7b2e3ab4d4523e83770a724a2088edbde7f19a",
      "jwt-attribute-email": "john@example.com",
      "jwt-attribute-firstname": "John",
      "jwt-attribute-lastname": "Doe",
      "jwt-enabled": true,
      "jwt-group-sync": true,
    };

    await userEvent.click(screen.getByLabelText(/User Provisioning/));
    await userEvent.type(
      await screen.findByRole("textbox", { name: /JWT Identity Provider URI/ }),
      ATTRS["jwt-identity-provider-uri"],
    );
    await userEvent.type(
      await screen.findByRole("textbox", {
        name: /String used by the JWT signing key/,
      }),
      ATTRS["jwt-shared-secret"],
    );
    await userEvent.type(
      await screen.findByRole("textbox", { name: /Email attribute/ }),
      ATTRS["jwt-attribute-email"],
    );
    await userEvent.type(
      await screen.findByRole("textbox", { name: /First name attribute/ }),
      ATTRS["jwt-attribute-firstname"],
    );
    await userEvent.type(
      await screen.findByRole("textbox", { name: /Last name attribute/ }),
      ATTRS["jwt-attribute-lastname"],
    );
    const groupSchema = await screen.findByTestId("jwt-group-schema");
    await userEvent.click(within(groupSchema).getByRole("switch")); // checkbox for "jwt-group-sync"

    await userEvent.click(await screen.findByRole("button", { name: /Save/ }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(ATTRS);
    });
  });
});
