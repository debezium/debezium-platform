import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ConnectorImage from "./ComponentImage";
import { render } from "../__test__/unit/test-utils";

vi.mock("./TrademarkMessage", () => ({
  default: () => null,
}));

const cases: [string, RegExp][] = [
  ["mongo", /MongoDB icon/i],
  ["postgre", /Postgres icon/i],
  ["cassandra", /Cassandra icon/i],
  ["mysql", /MySQL icon/i],
  ["sqlserver", /SqlServer icon/i],
  ["pulsar", /Apache Pulsar icon/i],
  ["rocketmq", /RocketMQ icon/i],
  ["eventhubs", /EventHub icon/i],
  ["rabbitmq", /RabbitMQ icon/i],
  ["nats-streaming", /NATS Stream icon/i],
  ["nats-jetstream", /NATS JetStream icon/i],
  ["kafka", /Kafka icon/i],
  ["infinispan", /Infinispan icon/i],
  ["pubsub_lite", /Pub\/SUB icon/i],
  ["google_pubsub", /Pub\/Sub liet icon/i],
  ["pravega", /Pravega icon/i],
  ["oracle", /Oracle icon/i],
  ["mariadb", /MariaDB icon/i],
  ["kinesis", /Kinesis icon/i],
  ["milvus", /Milvus icon/i],
  ["qdrant", /Qdrant icon/i],
  ["redis", /Redis\(Stream\) icon/i],
  ["http_sink", /HTTP icon/i],
  ["db2", /IBM Db2 icon/i],
];

describe("ConnectorImage (ComponentImage)", () => {
  it.each(cases)(
    "maps connectorType %s to the expected image alt",
    (connectorType, alt) => {
      render(<ConnectorImage connectorType={connectorType} size={32} />);
      expect(screen.getByRole("img", { name: alt })).toBeInTheDocument();
    },
  );

  it("uses default Debezium asset for unknown connector types", () => {
    render(<ConnectorImage connectorType="totally-unknown" size={28} />);
    expect(screen.getByRole("img", { name: /Debezium icon/i })).toBeInTheDocument();
  });

  it("renders an image for a known connector type with correct alt", () => {
    render(<ConnectorImage connectorType="postgresql" size={40} />);
    const img = screen.getByRole("img", { name: /Postgres icon/i });
    expect(img).toHaveAttribute("src");
    expect(img).toHaveStyle({ maxHeight: "40px" });
  });

  it("omits trademark when designerComponent is true", () => {
    const { container } = render(
      <ConnectorImage connectorType="kafka" designerComponent size={30} />,
    );
    expect(container.querySelector("#trademark-msg")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Kafka icon/i })).toBeInTheDocument();
  });

  it("uses fixed alt when size is omitted (non-sized branch)", () => {
    render(<ConnectorImage connectorType="kafka" />);
    expect(screen.getByRole("img", { name: "mongo icon" })).toBeInTheDocument();
  });
});
