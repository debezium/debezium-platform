/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import java.time.Duration;
import java.util.List;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import jakarta.ws.rs.BadRequestException;

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;

import io.debezium.platform.data.model.AlertRuleEntity;
import io.debezium.platform.domain.alert.AlertRuleDeleted;
import io.debezium.platform.domain.views.AlertRule;
import io.debezium.platform.domain.views.refs.AlertRuleReference;
import io.debezium.platform.error.NotFoundException;

@ApplicationScoped
public class AlertRuleService extends AbstractService<AlertRuleEntity, AlertRule, AlertRuleReference> {

    private final PanelConfigLoader panelConfigLoader;
    private final Event<AlertRuleDeleted> ruleDeletedEvent;

    public AlertRuleService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm,
                            PanelConfigLoader panelConfigLoader, Event<AlertRuleDeleted> ruleDeletedEvent) {
        super(AlertRuleEntity.class, AlertRule.class, AlertRuleReference.class, em, cbf, evm);
        this.panelConfigLoader = panelConfigLoader;
        this.ruleDeletedEvent = ruleDeletedEvent;
    }

    @Override
    public AlertRule create(@Valid AlertRule view) {
        validatePanelExists(view.getPanelId());
        validateForDuration(view.getForDuration());
        validateEvaluationWindow(view.getEvaluationWindow());
        return super.create(view);
    }

    @Override
    public AlertRule update(@Valid AlertRule view) {
        validatePanelExists(view.getPanelId());
        validateForDuration(view.getForDuration());
        validateEvaluationWindow(view.getEvaluationWindow());
        return super.update(view);
    }

    /**
     * Fires {@link AlertRuleDeleted} before deleting the rule, so that its active alerts get resolved
     * while the rule still exists. The rule's states are removed with it, but its events only lose their
     * rule reference, so an event that is firing at that moment would stay firing forever: nothing
     * evaluates it again and the history cleanup only removes resolved events.
     */
    @Override
    public void delete(long id) {
        AlertRuleEntity rule = em.find(AlertRuleEntity.class, id);
        if (rule != null) {
            ruleDeletedEvent.fire(new AlertRuleDeleted(rule));
            // write what the observers changed before the rule row goes away, otherwise the delete below
            // runs first and an event update then fails its foreign key to the rule
            em.flush();
        }
        super.delete(id);
    }

    public AlertRule enable(Long id) {
        AlertRule rule = findById(id).orElseThrow(() -> new NotFoundException(id));
        rule.setEnabled(true);
        return update(rule);
    }

    public AlertRule disable(Long id) {
        AlertRule rule = findById(id).orElseThrow(() -> new NotFoundException(id));
        rule.setEnabled(false);
        return update(rule);
    }

    private void validatePanelExists(String panelId) {
        boolean exists = panelConfigLoader.loadPanels().stream()
                .anyMatch(p -> p.id().equals(panelId));
        if (!exists) {
            throw new BadRequestException("Panel '" + panelId + "' does not exist");
        }
    }

    public List<AlertRuleEntity> findAllEnabled() {
        return cb().where("enabled").eq(true)
                .getResultList();
    }

    public List<AlertRuleEntity> findAllEnabledWithChannels() {
        return em.createQuery(
                "SELECT DISTINCT r FROM alert_rule r LEFT JOIN FETCH r.channels WHERE r.enabled = true",
                AlertRuleEntity.class)
                .getResultList();
    }

    private void validateForDuration(String forDuration) {
        if (forDuration == null) {
            return;
        }
        Duration duration = Duration.parse(forDuration);
        if (duration.isNegative()) {
            throw new BadRequestException("forDuration must not be negative");
        }
        if (duration.compareTo(Duration.ofHours(1)) > 0) {
            throw new BadRequestException("forDuration must not exceed PT1H (1 hour)");
        }
    }

    private void validateEvaluationWindow(String evaluationWindow) {
        if (evaluationWindow == null) {
            return;
        }
        Duration duration = Duration.parse(evaluationWindow);
        if (duration.compareTo(Duration.ofMinutes(1)) < 0) {
            throw new BadRequestException("evaluationWindow must be at least PT1M (1 minute)");
        }
        if (duration.compareTo(Duration.ofHours(1)) > 0) {
            throw new BadRequestException("evaluationWindow must not exceed PT1H (1 hour)");
        }
    }
}
