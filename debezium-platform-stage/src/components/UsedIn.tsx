import { Button, Label, Popover } from "@patternfly/react-core"
import { DataSinkIcon, DataSourceIcon } from "@patternfly/react-icons"
import { MigrationIcon as PipelineIcon } from "@patternfly/react-icons";
import { t } from "i18next"
import { FC, Fragment } from "react"
import { useNavigate } from "react-router-dom"
import { sourcePageNavState } from "@sourcePage/sourcePageNavigation"
import { Connection, Destination, Pipeline, ResourceType, Source, TransformData } from "src/apis"

interface IUsedInProps {
    resourceList: Source[] | Destination[] | Pipeline[],
    resourceType: string,
    instance: Source | Destination | Connection | TransformData,
    requestedPageType: ResourceType
}

export const getActiveConnectionCount = (
    resourceList: Source[] | Destination[],
    id: number,
): number => {
    return resourceList.filter((resource) => resource?.connection?.id === id).length;
};

export const getActivePipelineCount = (
    pipelineList: Pipeline[],
    id: number,
    type: "source" | "destination" | "transform"
): number => {
    if (type === "transform") {
        return pipelineList.filter((pipeline) =>
            Array.isArray(pipeline["transforms"]) &&
            pipeline["transforms"].some(transform => transform.id === id)
        ).length;
    } else {
        return pipelineList.filter((pipeline) => pipeline[type].id === id).length;
    }
};

const UsedIn: FC<IUsedInProps> = ({ resourceList, resourceType, instance, requestedPageType }) => {
    const navigate = useNavigate();
    const activeCount = requestedPageType === "connection" ? getActiveConnectionCount(resourceList as Source[] | Destination[], instance.id) : getActivePipelineCount(resourceList as Pipeline[], instance.id, requestedPageType as "source" | "destination" | "transform");
    const icon = resourceType === "source" ? <DataSourceIcon /> : resourceType === "destination" ? <DataSinkIcon /> : <PipelineIcon />;
    const labelColor = activeCount === 0 ? "grey" : "blue";
    const label = (
        <Label isDisabled={activeCount === 0} icon={icon} color={labelColor}>
            &nbsp;{activeCount}
        </Label>
    );
    const onNameClick = (id: number) => {
        if (requestedPageType === "connection") {
            if (resourceType === "source") {
                navigate(`/${resourceType}/${id}?state=view`, {
                    state: sourcePageNavState.view,
                });
            } else {
                navigate(`/${resourceType}/${id}?state=view`);
            }
        } else {
            navigate(`/${resourceType}/${id}/overview`);
        }
    };

    const getActiveResourceDetails = (
        resourceList: Source[] | Destination[] | Pipeline[],
        id: number,
    ): { name: string, id: number }[] => {
        if (requestedPageType === "connection") {
            return (resourceList as Source[] | Destination[])
                .filter((resource) => resource?.connection?.id === id)
                .map((resource) => ({ name: resource?.name, id: resource?.id }));
        }
        else if (requestedPageType === "source" || requestedPageType === "destination") {
            return (resourceList as Pipeline[])
                .filter((resource) => resource?.[requestedPageType as "source" | "destination"]?.id === id)
                .map((resource) => ({ name: resource?.name, id: resource?.id }));
        }
        else {
            return (resourceList as Pipeline[])
                .filter((resource) => resource?.transforms?.some((transform) => transform.id === id))
                .map((resource) => ({ name: resource?.name, id: resource?.id }));
        }
    };


    if (activeCount === 0) {
        return label;
    }

    return (
        <Popover
            triggerAction="hover"
            aria-label="used in popover"
            bodyContent={
                <div>
                    {t("activeResourceUsingTooltip", {
                        val1: requestedPageType,
                        val2: resourceType,
                    })}
                    {
                        getActiveResourceDetails(resourceList as Source[] | Destination[] | Pipeline[], instance.id).map(({ name, id }, idx, arr) => (
                            <Fragment key={id}>
                                <Button
                                    variant="link"
                                    isInline
                                    onClick={() => onNameClick(id)}
                                >
                                    {name}
                                </Button>{idx === arr.length - 1 ? "." : ", "}
                            </Fragment>
                        ))
                    }
                </div>
            }
        >
            {label}
        </Popover>
    )
}

export default UsedIn;