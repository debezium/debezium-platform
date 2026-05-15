package io.debezium.platform.error;

public class NotFoundException extends RuntimeException {

    private final long id;

    public NotFoundException(Long id) {
        super("Invalid resource with id: " + id);
        this.id = id;
    }

    public long getId() {
        return id;
    }
}
