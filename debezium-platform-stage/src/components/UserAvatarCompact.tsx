import {
  Dropdown,
  MenuToggleElement,
  MenuToggle,
  Avatar,
  DropdownList,
  DropdownItem,
  Divider,
} from "@patternfly/react-core";
import React, { useState } from "react";
import imgAvatar from "@patternfly/react-core/src/components/assets/avatarImg.svg";

interface UserAvatarCompactProps {}

const UserAvatarCompact: React.FC<UserAvatarCompactProps> = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const onDropdownSelect = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const onDropdownToggle = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const userDropdownItems = [
    <>
      <DropdownItem key="group 2 ">Username</DropdownItem>
      <Divider component="li" key="separator" />
      <DropdownItem key="group 2 profile">My profile</DropdownItem>
      <DropdownItem key="group 2 user">User management</DropdownItem>
      <DropdownItem key="group 2 logout">Logout</DropdownItem>
    </>,
  ];

  return (
    <Dropdown
      isOpen={isDropdownOpen}
      onSelect={onDropdownSelect}
      onOpenChange={(isOpen: boolean) => setIsDropdownOpen(isOpen)}
      popperProps={{ position: "right" }}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          aria-label="kebab dropdown toggle"
          variant="plain"
          onClick={onDropdownToggle}
          isExpanded={isDropdownOpen}
        >
          <Avatar src={imgAvatar} alt="" />
        </MenuToggle>
      )}
    >
      <DropdownList>{userDropdownItems}</DropdownList>
    </Dropdown>
  );
};

export default UserAvatarCompact;
